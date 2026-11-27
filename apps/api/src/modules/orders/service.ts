import type { Role } from '@myfood/shared';
import { bad, conflict, notFound } from '../../core/errors.js';
import { get, run, tx } from '../../db/index.js';
import { calculateCommission } from '@myfood/shared';
import { notify } from '../../core/notifications.js';
import { emitMany } from '../../realtime/index.js';
import { now, uid } from '../../core/utils.js';

export const TRANSITIONS: Record<string, string[]> = {
  placed: ['awaiting_confirmation', 'accepted', 'cancelled', 'failed'],
  awaiting_confirmation: ['accepted', 'cancelled', 'failed'],
  accepted: ['preparing', 'cancelled', 'failed'],
  preparing: ['awaiting_courier', 'cancelled', 'failed'],
  awaiting_courier: ['courier_to_store', 'cancelled', 'failed'],
  courier_to_store: ['picked_up', 'cancelled', 'failed'],
  picked_up: ['on_the_way', 'failed'],
  on_the_way: ['delivered', 'failed'],
  delivered: [], cancelled: [], failed: [],
};

interface OrderRow { id: string; customer_id: string; establishment_id: string; status: string; total_cents: number;
  subtotal_cents: number; discount_cents: number; delivery_fee_cents: number; payment_status: string }

export function orderActors(orderId: string) {
  const row = get<any>(`SELECT o.customer_id, e.owner_id AS merchant_user_id, d.courier_id, c.user_id AS courier_user_id
    FROM orders o JOIN establishments e ON e.id=o.establishment_id
    LEFT JOIN deliveries d ON d.order_id=o.id LEFT JOIN couriers c ON c.id=d.courier_id WHERE o.id=?`, orderId);
  if (!row) return { customer_id: null, merchant_user_id: null, courier_user_id: null };
  return { customer_id: row.customer_id, merchant_user_id: row.merchant_user_id, courier_user_id: row.courier_user_id };
}

const NOTIF_COPY: Record<string, { title: string; body: string }> = {
  accepted: { title: 'Pedido aceito!', body: 'O estabelecimento aceitou seu pedido e começará o preparo.' },
  preparing: { title: 'Seu pedido está em preparação', body: 'Estamos preparando seu pedido com carinho.' },
  awaiting_courier: { title: 'Aguardando entregador', body: 'Seu pedido está pronto e procurando um entregador.' },
  courier_to_store: { title: 'Entregador a caminho', body: 'Um entregador está indo buscar seu pedido.' },
  picked_up: { title: 'Pedido retirado', body: 'Seu pedido foi retirado do estabelecimento.' },
  on_the_way: { title: 'Saiu para entrega', body: 'Seu pedido está a caminho!' },
  delivered: { title: 'Pedido entregue', body: 'Bom apetite! Avalie sua experiência no app.' },
  cancelled: { title: 'Pedido cancelado', body: 'Seu pedido foi cancelado. Confira os detalhes.' },
  failed: { title: 'Falha no pedido', body: 'Houve um problema com seu pedido. Nossa equipe foi avisada.' },
};

export function transitionOrder(orderId: string, to: string, actorId: string | null, actorRole: Role | 'system', reason?: string) {
  return tx(() => {
    const order = get<OrderRow>('SELECT * FROM orders WHERE id=?', orderId);
    if (!order) throw notFound('Pedido não encontrado');
    if (order.status === to) return order;
    if (!TRANSITIONS[order.status]?.includes(to))
      throw conflict(`Transição inválida: ${order.status} → ${to}`);
    if (to === 'cancelled' && !reason) throw bad('Informe o motivo do cancelamento');

    const stamp = now();
    run('INSERT INTO order_status_history (id,order_id,from_status,to_status,actor_id,created_at) VALUES (?,?,?,?,?,?)',
      uid(), orderId, order.status, to, actorId, stamp);
    const update: string[] = ['status=?', 'updated_at=?'];
    const params: any[] = [to, stamp];
    if (to === 'accepted') { update.push('accepted_at=?'); params.push(stamp); }
    if (to === 'delivered') { update.push('delivered_at=?'); params.push(stamp); }
    if (to === 'cancelled') { update.push('cancellation_reason=?'); params.push(reason ?? ''); }
    if (reason && to !== 'cancelled') { update.push('notes=COALESCE(notes,\'\') || ?'); params.push(` | ${reason}`); }
    params.push(orderId);
    run(`UPDATE orders SET ${update.join(',')} WHERE id=?`, ...params);

    const actors = orderActors(orderId);
    const copy = NOTIF_COPY[to];
    if (copy) {
      notify(actors.customer_id, `order:${to}`, copy.title, copy.body, { orderId, status: to });
      if (to === 'cancelled' || to === 'failed') {
        notify(actors.merchant_user_id, `order:${to}`, copy.title, `Pedido ${orderId.slice(-6).toUpperCase()} — ${reason ?? copy.body}`, { orderId });
        notify(actors.courier_user_id, `order:${to}`, copy.title, `Pedido ${orderId.slice(-6).toUpperCase()} cancelado`, { orderId });
      }
    }
    if (to === 'awaiting_courier') notify(actors.merchant_user_id, 'order:needs_courier', 'Solicite um entregador', 'Seu pedido está pronto para retirada.', { orderId });
    if (to === 'delivered') settleOrder(orderId);
    emitMany([actors.customer_id, actors.merchant_user_id, actors.courier_user_id], 'order:updated', { orderId, status: to, at: stamp });
    return get<OrderRow>('SELECT * FROM orders WHERE id=?', orderId)!;
  });
}

/** Fechamento financeiro: no máximo UMA comissão por pedido (UNIQUE order_id). */
export function settleOrder(orderId: string) {
  return tx(() => {
    const order = get<any>('SELECT * FROM orders WHERE id=?', orderId);
    if (!order) throw notFound('Pedido não encontrado');
    const existing = get<any>('SELECT * FROM commissions WHERE order_id=?', orderId);
    if (existing) return existing;
    if (!['approved', 'not_required'].includes(order.payment_status))
      return { pending: true, reason: 'Pagamento ainda não confirmado' };
    const est = get<any>('SELECT * FROM establishments WHERE id=?', order.establishment_id)!;
    const c = calculateCommission({
      productBaseCents: order.subtotal_cents - order.discount_cents,
      deliveryFeeCents: order.delivery_fee_cents,
      productRateBps: est.commission_products_bps,
      deliveryRateBps: est.commission_delivery_bps,
    });
    const id = uid();
    run(`INSERT INTO commissions (id,order_id,product_base_cents,product_rate_bps,product_commission_cents,delivery_fee_cents,delivery_rate_bps,delivery_commission_cents,platform_revenue_cents,courier_payout_cents,merchant_payout_cents,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, id, orderId, c.productBaseCents, c.productRateBps, c.productCommissionCents,
      c.deliveryFeeCents, c.deliveryRateBps, c.deliveryCommissionCents, c.platformRevenueCents, c.courierPayoutCents, c.merchantPayoutCents, now());
    const owner = get<{ owner_id: string }>('SELECT owner_id FROM establishments WHERE id=?', order.establishment_id);
    run('INSERT INTO payouts (id,order_id,recipient_id,recipient_type,amount_cents,status,created_at) VALUES (?,?,?,?,?,?,?)',
      uid(), orderId, owner?.owner_id ?? '', 'merchant', c.merchantPayoutCents, 'pending', now());
    const delivery = get<any>('SELECT courier_id, fee_cents FROM deliveries WHERE order_id=?', orderId);
    if (delivery?.courier_id && c.courierPayoutCents > 0) {
      run('INSERT INTO payouts (id,order_id,recipient_id,recipient_type,amount_cents,status,created_at) VALUES (?,?,?,?,?,?,?)',
        uid(), orderId, delivery.courier_id, 'courier', c.courierPayoutCents, 'pending', now());
    }
    return get<any>('SELECT * FROM commissions WHERE order_id=?', orderId)!;
  });
}
