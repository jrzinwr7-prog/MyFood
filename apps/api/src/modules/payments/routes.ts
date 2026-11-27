import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../../core/auth.js';
import { asyncRoute } from '../../core/http.js';
import { bad, conflict, notFound, unauthorized } from '../../core/errors.js';
import { get, all, run, tx, audit } from '../../db/index.js';
import { now, uid, json } from '../../core/utils.js';
import { activeProvider } from './provider.js';
import { notify } from '../../core/notifications.js';
import { emitMany } from '../../realtime/index.js';
import { settleOrder, orderActors } from '../orders/service.js';

export const paymentsRouter = Router();
export const webhookRouter = Router();

paymentsRouter.post('/orders/:id/initialize', authenticate, asyncRoute(async (req, res) => {
  const body = z.object({ method: z.enum(['pix', 'credit_card', 'debit_card', 'cash', 'pix_manual']),
    cardToken: z.string().optional(), pixManual: z.boolean().optional() }).parse(req.body ?? {});
  const order = get<any>('SELECT * FROM orders WHERE id=?', req.params.id);
  if (!order) throw notFound('Pedido não encontrado');
  if (order.customer_id !== req.auth!.id) throw notFound('Pedido não encontrado');
  if (!['placed', 'awaiting_confirmation', 'accepted'].includes(order.status)) throw conflict('Pedido não aceita mais pagamento');
  const method = body.pixManual ? 'pix_manual' : body.method;
  const existing = get<any>('SELECT * FROM payments WHERE order_id=?', order.id);
  if (existing) {
    if (!existing.reply_json) throw conflict('Pagamento em processamento');
    return res.json({ payment: publicPayment(existing), ...JSON.parse(existing.reply_json) });
  }
  const idempotencyKey = String(req.headers['idempotency-key'] ?? uid('idem_'));
  const provider = activeProvider();
  const init = {
    id: uid('pay_'), orderId: order.id, amountCents: order.total_cents, method,
    description: `Pedido MyFood ${order.id.slice(-6).toUpperCase()}`, idempotencyKey,
    payerEmail: req.auth!.email, notificationUrl: `${process.env.WEBHOOK_BASE_URL ?? ''}/api/webhooks/${provider.name}`,
    raw: { cardToken: body.cardToken },
  };
  const result = await provider.initialize(init);
  const payment = tx(() => {
    const p = get<any>('SELECT * FROM payments WHERE order_id=?', order.id);
    if (p) return p; // corrida garantida pelo UNIQUE(order_id)
    run(`INSERT INTO payments (id,order_id,provider,provider_payment_id,method,status,amount_cents,idempotency_key,reply_json,raw_json,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, init.id, order.id, provider.name, result.providerId, method, result.status,
      order.total_cents, idempotencyKey, json({ ...result, raw: undefined }), json(result.raw), now(), now());
    run('INSERT INTO transactions (id,payment_id,order_id,type,amount_cents,status,external_id,created_at) VALUES (?,?,?,?,?,?,?,?)',
      uid(), init.id, order.id, 'charge', order.total_cents, result.status, result.providerId, now());
    if (result.status === 'approved') run('UPDATE orders SET payment_status=\'approved\' WHERE id=?', order.id);
    return get<any>('SELECT * FROM payments WHERE id=?', init.id)!;
  });
  const actors = orderActors(order.id);
  notify(actors.merchant_user_id, 'payment:updated', 'Pagamento atualizado', `Pagamento do pedido ${order.id.slice(-6).toUpperCase()}: ${result.status}.`, { orderId: order.id });
  res.status(201).json({ payment: publicPayment(payment), ...result });
}));

paymentsRouter.get('/orders/:id', authenticate, asyncRoute((req, res) => {
  const p = get<any>('SELECT * FROM payments WHERE order_id=?', req.params.id);
  if (!p) throw notFound('Pagamento não encontrado');
  const order = get<any>('SELECT customer_id, establishment_id FROM orders WHERE id=?', req.params.id);
  const allowed = req.auth!.role === 'admin' || order?.customer_id === req.auth!.id ||
    (get<any>('SELECT owner_id FROM establishments WHERE id=?', order?.establishment_id)?.owner_id === req.auth!.id);
  if (!allowed) throw unauthorized();
  res.json({ payment: publicPayment(p), transactions: all('SELECT * FROM transactions WHERE payment_id=? ORDER BY created_at DESC', p.id) });
}));

/** Confirmação manual explícita de pagamento em dinheiro/PIX sem provedor. */
paymentsRouter.post('/:id/confirm-manual', authenticate, requireRole('merchant', 'admin'), asyncRoute((req, res) => {
  const p = get<any>('SELECT * FROM payments WHERE id=?', req.params.id);
  if (!p) throw notFound('Pagamento não encontrado');
  if (!['cash', 'pix_manual'].includes(p.method)) throw bad('Este pagamento exige confirmação automática do provedor');
  if (p.status === 'approved') return res.json({ ok: true, payment: publicPayment(p) });
  if (req.auth!.role === 'merchant') {
    const order = get<any>('SELECT establishment_id FROM orders WHERE id=?', p.order_id);
    if (get<any>('SELECT owner_id FROM establishments WHERE id=?', order?.establishment_id)?.owner_id !== req.auth!.id) throw unauthorized();
  }
  tx(() => {
    run('UPDATE payments SET status=\'approved\', updated_at=? WHERE id=?', now(), p.id);
    run('UPDATE orders SET payment_status=\'approved\' WHERE id=?', p.order_id);
    run('INSERT INTO transactions (id,payment_id,order_id,type,amount_cents,status,created_at) VALUES (?,?,?,?,?,?,?)',
      uid(), p.id, p.order_id, 'manual_confirmation', p.amount_cents, 'approved', now());
  });
  audit(req.auth!.id, req.auth!.role, 'payment.manual_confirm', 'payment', p.id, { orderId: p.order_id }, req.ip);
  const actors = orderActors(p.order_id);
  notify(actors.customer_id, 'payment:approved', 'Pagamento confirmado', 'Seu pagamento foi confirmado pelo estabelecimento.', { orderId: p.order_id });
  emitMany([actors.customer_id, actors.merchant_user_id], 'payment:updated', { orderId: p.order_id, status: 'approved' });
  settleOrder(p.order_id);
  res.json({ ok: true, payment: publicPayment(get<any>('SELECT * FROM payments WHERE id=?', p.id)!) });
}));

paymentsRouter.post('/:id/refund', authenticate, requireRole('admin'), asyncRoute(async (req, res) => {
  const body = z.object({ amountCents: z.number().int().positive().optional(), reason: z.string().min(3) }).parse(req.body);
  const p = get<any>('SELECT * FROM payments WHERE id=?', req.params.id);
  if (!p) throw notFound('Pagamento não encontrado');
  const amount = body.amountCents ?? p.amount_cents;
  if (amount > p.amount_cents) throw bad('Valor do estorno superior ao pago');
  let external: string | null = null;
  if (p.provider !== 'none' && p.provider_payment_id) external = await activeProvider().refund(p.provider_payment_id, amount);
  tx(() => {
    run('INSERT INTO refunds (id,payment_id,order_id,amount_cents,reason,status,external_id,created_at) VALUES (?,?,?,?,?,?,?,?)',
      uid(), p.id, p.order_id, amount, body.reason, 'refunded', external, now());
    run('UPDATE payments SET status=\'refunded\', updated_at=? WHERE id=?', now(), p.id);
    run('UPDATE orders SET payment_status=\'refunded\' WHERE id=?', p.order_id);
    run('INSERT INTO transactions (id,payment_id,order_id,type,amount_cents,status,external_id,created_at) VALUES (?,?,?,?,?,?,?,?)',
      uid(), p.id, p.order_id, 'refund', amount, 'refunded', external, now());
  });
  audit(req.auth!.id, 'admin', 'payment.refund', 'payment', p.id, { amount, reason: body.reason }, req.ip);
  notify(orderActors(p.order_id).customer_id, 'payment:refunded', 'Estorno realizado', 'Seu estorno foi processado.', { orderId: p.order_id });
  res.json({ ok: true });
}));

/** Webhook: raw body obrigatório para validar assinatura; eventos são idempotentes. */
webhookRouter.post('/:provider', asyncRoute(async (req, res) => {
  const provider = activeProvider();
  if (req.params.provider !== provider.name) throw notFound('Provedor não configurado');
  const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body ?? {});
  if (!provider.verifyWebhook({ headers: req.headers as any, rawBody: raw })) throw unauthorized('Assinatura de webhook inválida');
  let payload: any;
  try { payload = JSON.parse(raw); } catch { payload = Object.fromEntries(new URLSearchParams(raw)); }
  const event = provider.normalizeEvent(payload);
  if (!event.eventId) throw bad('Evento sem identificador');
  if (get('SELECT id FROM webhook_events WHERE provider=? AND event_id=?', provider.name, event.eventId))
    return res.json({ ok: true, duplicate: true });
  run('INSERT INTO webhook_events (id,provider,event_id,payload,created_at) VALUES (?,?,?,?,?)',
    uid(), provider.name, event.eventId, raw, now());
  if (event.paymentId) {
    const p = get<any>('SELECT * FROM payments WHERE provider_payment_id=?', event.paymentId);
    if (p) {
      const status = event.status;
      if (status === 'approved' && p.status !== 'approved') {
        tx(() => {
          run('UPDATE payments SET status=\'approved\', updated_at=? WHERE id=?', now(), p.id);
          run('UPDATE orders SET payment_status=\'approved\' WHERE id=?', p.order_id);
          run('INSERT INTO transactions (id,payment_id,order_id,type,amount_cents,status,external_id,created_at) VALUES (?,?,?,?,?,?,?,?)',
            uid(), p.id, p.order_id, 'webhook_approval', p.amount_cents, 'approved', event.eventId, now());
        });
        settleOrder(p.order_id);
      } else if (['rejected', 'refunded'].includes(status)) {
        run('UPDATE payments SET status=?, updated_at=? WHERE id=?', status, now(), p.id);
        run('UPDATE orders SET payment_status=? WHERE id=?', status, p.order_id);
      }
    }
  }
  res.json({ ok: true });
}));

function publicPayment(p: any) {
  return { id: p.id, provider: p.provider, providerPaymentId: p.provider_payment_id, method: p.method, status: p.status,
    amountCents: p.amount_cents, createdAt: p.created_at, updatedAt: p.updated_at };
}
