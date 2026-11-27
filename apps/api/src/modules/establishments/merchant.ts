import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../../core/auth.js';
import { asyncRoute } from '../../core/http.js';
import { bad, conflict, notFound, unauthorized } from '../../core/errors.js';
import { all, get, run, tx, audit, setSetting } from '../../db/index.js';
import { now, uid, json, parseJson } from '../../core/utils.js';
import { notify } from '../../core/notifications.js';
import { emit, emitMany } from '../../realtime/index.js';
import { transitionOrder } from '../orders/service.js';
import { haversineKm } from '@myfood/shared';

export const merchantRouter = Router();
merchantRouter.use(authenticate, requireRole('merchant'));

function myEstablishment(userId: string) {
  const est = get<any>('SELECT * FROM establishments WHERE owner_id=?', userId);
  if (!est) throw notFound('Estabelecimento não encontrado');
  return est;
}

merchantRouter.get('/me', asyncRoute((req, res) => {
  const est = myEstablishment(req.auth!.id);
  res.json({ establishment: { ...est, openHours: parseJson(est.open_hours, {}) },
    user: get<any>('SELECT id,name,email,phone,status FROM users WHERE id=?', req.auth!.id) });
}));

merchantRouter.patch('/me', asyncRoute((req, res) => {
  const est = myEstablishment(req.auth!.id);
  const body = z.object({
    name: z.string().min(2).max(120).optional(), description: z.string().max(1000).optional(),
    logoUrl: z.string().max(1000).nullable().optional(), coverUrl: z.string().max(1000).nullable().optional(),
    phone: z.string().min(10).optional(), categoryId: z.string().optional(),
    cep: z.string().min(8).optional(), street: z.string().min(1).optional(), number: z.string().min(1).optional(),
    complement: z.string().nullable().optional(), neighborhood: z.string().min(1).optional(),
    city: z.string().min(1).optional(), state: z.string().length(2).optional(),
    latitude: z.number().nullable().optional(), longitude: z.number().nullable().optional(),
    deliveryFeeCents: z.number().int().min(0).optional(), minOrderCents: z.number().int().min(0).optional(),
    prepTimeMin: z.number().int().min(1).optional(), deliveryRadiusKm: z.number().min(0.5).max(100).optional(),
    deliveryEnabled: z.boolean().optional(), pickupEnabled: z.boolean().optional(),
    openHours: z.record(z.object({ open: z.string(), close: z.string(), closed: z.boolean() })).optional(),
  }).parse(req.body);
  const map: Record<string, string> = { logoUrl: 'logo_url', coverUrl: 'cover_url', categoryId: 'category_id',
    deliveryFeeCents: 'delivery_fee_cents', minOrderCents: 'min_order_cents', prepTimeMin: 'prep_time_min',
    deliveryRadiusKm: 'delivery_radius_km', deliveryEnabled: 'delivery_enabled', pickupEnabled: 'pickup_enabled', openHours: 'open_hours' };
  const entries = Object.entries(body).filter(([, v]) => v !== undefined);
  if (entries.length) {
    run(`UPDATE establishments SET ${entries.map(([k]) => `${map[k] ?? k}=?`).join(',')} WHERE id=? AND owner_id=?`,
      ...entries.map(([k, v]) => k === 'openHours' ? json(v) : typeof v === 'boolean' ? (v ? 1 : 0) : v), est.id, req.auth!.id);
    audit(req.auth!.id, 'merchant', 'establishment.updated', 'establishment', est.id, { fields: entries.map(([k]) => k) }, req.ip);
  }
  res.json({ establishment: get<any>('SELECT * FROM establishments WHERE id=?', est.id) });
}));

merchantRouter.get('/dashboard', asyncRoute((req, res) => {
  const est = myEstablishment(req.auth!.id);
  const today = new Date().toISOString().slice(0, 10);
  const one = (sql: string, ...p: any[]) => get<{ n: number; sum: number | null }>(sql, ...p) ?? { n: 0, sum: 0 };
  res.json({
    orders: {
      received: one('SELECT COUNT(*) n, COALESCE(SUM(total_cents),0) sum FROM orders WHERE establishment_id=?', est.id).n,
      active: one("SELECT COUNT(*) n FROM orders WHERE establishment_id=? AND status IN ('placed','awaiting_confirmation','accepted','preparing','awaiting_courier','courier_to_store','picked_up','on_the_way')", est.id).n,
      completed: one("SELECT COUNT(*) n FROM orders WHERE establishment_id=? AND status='delivered'", est.id).n,
      today: one('SELECT COUNT(*) n, COALESCE(SUM(total_cents),0) sum FROM orders WHERE establishment_id=? AND date(created_at)=?', est.id, today),
    },
    revenueCents: one("SELECT COUNT(*) n, COALESCE(SUM(merchant_payout_cents),0) sum FROM commissions c JOIN orders o ON o.id=c.order_id WHERE o.establishment_id=?", est.id).sum ?? 0,
    avgRating: get<{ avg: number }>("SELECT AVG(rating) avg FROM reviews WHERE target_type='establishment' AND target_id=?", est.id)?.avg ?? 0,
    topProducts: all<any>(`SELECT i.name_snapshot name, SUM(i.quantity) qty, SUM(i.total_cents) revenue FROM order_items i
      JOIN orders o ON o.id=i.order_id WHERE o.establishment_id=? GROUP BY i.product_id,i.name_snapshot ORDER BY qty DESC LIMIT 5`, est.id),
  });
}));

merchantRouter.get('/orders', asyncRoute((req, res) => {
  const est = myEstablishment(req.auth!.id);
  const status = String(req.query.status ?? '');
  const items = all<any>(`SELECT o.*, a.label address_label, a.street, a.number, a.complement, a.neighborhood,
    u.name customer_name, u.phone customer_phone, d.status delivery_status, d.courier_id,
    cu.name courier_name FROM orders o LEFT JOIN addresses a ON a.id=o.address_id JOIN users u ON u.id=o.customer_id
    LEFT JOIN deliveries d ON d.order_id=o.id LEFT JOIN couriers c ON c.id=d.courier_id LEFT JOIN users cu ON cu.id=c.user_id
    WHERE o.establishment_id=? ${status ? 'AND o.status=?' : ''} ORDER BY o.created_at DESC LIMIT 200`,
    ...(status ? [est.id, status] : [est.id]));
  res.json({ items });
}));

merchantRouter.post('/orders/:id/accept', asyncRoute((req, res) => {
  const est = myEstablishment(req.auth!.id);
  assertOwnOrder(req.params.id, est.id);
  const body = z.object({ prepMinutes: z.number().int().min(1).max(240).optional() }).parse(req.body ?? {});
  const order = transitionOrder(req.params.id, 'accepted', req.auth!.id, 'merchant');
  if (body.prepMinutes) run('UPDATE orders SET notes=COALESCE(notes,\'\') || ? WHERE id=?', ` | Preparo estimado: ${body.prepMinutes} min`, order.id);
  notify(order.customer_id, 'order:prep_estimate', 'Tempo de preparo', `Preparo estimado: ${body.prepMinutes ?? est.prep_time_min} min.`, { orderId: order.id });
  res.json({ order });
}));
merchantRouter.post('/orders/:id/reject', asyncRoute((req, res) => {
  const est = myEstablishment(req.auth!.id);
  assertOwnOrder(req.params.id, est.id);
  const body = z.object({ reason: z.string().min(3).max(300) }).parse(req.body);
  const order = transitionOrder(req.params.id, 'cancelled', req.auth!.id, 'merchant', body.reason);
  res.json({ order });
}));
merchantRouter.post('/orders/:id/status', asyncRoute((req, res) => {
  const est = myEstablishment(req.auth!.id);
  assertOwnOrder(req.params.id, est.id);
  const body = z.object({ status: z.enum(['preparing', 'awaiting_courier']) }).parse(req.body);
  const order = transitionOrder(req.params.id, body.status, req.auth!.id, 'merchant');
  res.json({ order });
}));

/** Solicita entregador: escolha atômica de entregadores online nearby com bloqueio de concorrência. */
merchantRouter.post('/orders/:id/request-courier', asyncRoute((req, res) => {
  const est = myEstablishment(req.auth!.id);
  assertOwnOrder(req.params.id, est.id);
  const order = get<any>('SELECT * FROM orders WHERE id=?', req.params.id)!;
  if (!['accepted', 'preparing', 'awaiting_courier'].includes(order.status))
    throw conflict('Pedido precisa estar aceito ou em preparação');
  const delivery = get<any>('SELECT * FROM deliveries WHERE order_id=?', order.id)!;
  if (!['not_requested', 'offered', 'awaiting_courier'].includes(delivery.status))
    throw conflict('Entrega já solicitada ou aceita');
  if (order.status !== 'awaiting_courier') transitionOrder(order.id, 'awaiting_courier', req.auth!.id, 'merchant');
  const nearby = all<any>(`SELECT c.id, c.user_id, c.latitude, c.longitude, u.name FROM couriers c JOIN users u ON u.id=c.user_id
    WHERE c.status='approved' AND c.online=1 AND u.status='active'`);
  const candidates = nearby.filter(c => {
    if (c.latitude == null || c.longitude == null || est.latitude == null || est.longitude == null) return true;
    return haversineKm(c.latitude, c.longitude, est.latitude, est.longitude) <= 15;
  });
  if (!candidates.length) {
    notify(req.auth!.id, 'courier:none', 'Sem entregadores disponíveis', 'Nenhum entregador online na região. Tente novamente em instantes.', { orderId: order.id });
    return res.status(202).json({ offered: 0, message: 'Nenhum entregador disponível no momento' });
  }
  const chosen = candidates.slice(0, 5);
  const stamp = now();
  tx(() => {
    run('UPDATE deliveries SET status=\'offered\', offered_at=?, version=version+1 WHERE id=? AND status IN (\'not_requested\',\'offered\',\'awaiting_courier\')', stamp, delivery.id);
    run('UPDATE orders SET courier_requested_at=? WHERE id=?', stamp, order.id);
  });
  for (const c of chosen) {
    emit(c.user_id, 'delivery:offer', { deliveryId: delivery.id, orderId: order.id, feeCents: delivery.fee_cents });
    notify(c.user_id, 'delivery:new', 'Nova solicitação de entrega', `Retirada em ${est.name} — R$ ${(delivery.fee_cents / 100).toFixed(2).replace('.', ',')}`, { orderId: order.id, deliveryId: delivery.id });
  }
  res.json({ offered: chosen.length });
}));

function assertOwnOrder(orderId: string, establishmentId: string) {
  const order = get<any>('SELECT id, establishment_id, customer_id FROM orders WHERE id=?', orderId);
  if (!order || order.establishment_id !== establishmentId) throw notFound('Pedido não encontrado');
}

merchantRouter.get('/finance', asyncRoute((req, res) => {
  const est = myEstablishment(req.auth!.id);
  res.json({
    commissions: all<any>(`SELECT c.*, o.created_at order_date FROM commissions c JOIN orders o ON o.id=c.order_id WHERE o.establishment_id=? ORDER BY c.created_at DESC LIMIT 200`, est.id),
    payouts: all<any>(`SELECT p.* FROM payouts p JOIN orders o ON o.id=p.order_id WHERE o.establishment_id=? AND p.recipient_type='merchant' ORDER BY p.created_at DESC LIMIT 200`, est.id),
    refunds: all<any>(`SELECT r.* FROM refunds r JOIN orders o ON o.id=r.order_id WHERE o.establishment_id=? ORDER BY r.created_at DESC LIMIT 100`, est.id),
    totals: get<any>(`SELECT COALESCE(SUM(c.product_base_cents),0) gross, COALESCE(SUM(c.product_commission_cents),0) commission,
      COALESCE(SUM(c.merchant_payout_cents),0) receivable FROM commissions c JOIN orders o ON o.id=c.order_id WHERE o.establishment_id=?`, est.id),
  });
}));

merchantRouter.get('/coupons', asyncRoute((req, res) => {
  const est = myEstablishment(req.auth!.id);
  res.json({ items: all('SELECT * FROM coupons WHERE establishment_id=? ORDER BY created_at DESC', est.id) });
}));
merchantRouter.post('/coupons', asyncRoute((req, res) => {
  const est = myEstablishment(req.auth!.id);
  const b = z.object({ code: z.string().min(3).max(30).regex(/^[A-Za-z0-9]+$/), kind: z.enum(['percent', 'fixed']),
    value: z.number().int().positive(), minOrderCents: z.number().int().min(0).default(0),
    endsAt: z.string().optional(), usageLimit: z.number().int().positive().optional() }).parse(req.body);
  if (b.kind === 'percent' && b.value > 90) throw bad('Desconto percentual máximo: 90%');
  const id = uid('cpn_');
  try {
    run(`INSERT INTO coupons (id,code,establishment_id,kind,value,min_order_cents,ends_at,usage_limit,created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
      id, b.code.toUpperCase(), est.id, b.kind, b.value, b.minOrderCents, b.endsAt ?? null, b.usageLimit ?? null, now());
  } catch { throw conflict('Código de cupom já existe'); }
  res.status(201).json({ coupon: get('SELECT * FROM coupons WHERE id=?', id) });
}));
merchantRouter.delete('/coupons/:id', asyncRoute((req, res) => {
  const est = myEstablishment(req.auth!.id);
  const r = run('DELETE FROM coupons WHERE id=? AND establishment_id=?', req.params.id, est.id);
  if (!r.changes) throw notFound('Cupom não encontrado');
  res.json({ ok: true });
}));
