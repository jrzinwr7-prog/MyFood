import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../../core/auth.js';
import { asyncRoute } from '../../core/http.js';
import { bad, conflict, notFound, unauthorized } from '../../core/errors.js';
import { get, all, run, tx, audit } from '../../db/index.js';
import { now, uid, json } from '../../core/utils.js';
import { manualProvider } from './provider.js';
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
  if (method !== order.payment_method) throw bad('O método informado não corresponde ao pedido.');
  if (!['cash', 'pix_manual'].includes(method)) throw bad('Pagamento online ainda não está disponível.', 'payment_provider_not_configured');
  const existing = get<any>('SELECT * FROM payments WHERE order_id=?', order.id);
  if (existing) {
    if (!existing.reply_json) throw conflict('Pagamento em processamento');
    return res.json({ payment: publicPayment(existing), ...JSON.parse(existing.reply_json) });
  }
  const idempotencyKey = String(req.headers['idempotency-key'] ?? uid('idem_'));
  const provider = manualProvider;
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
  if (req.auth!.role === 'merchant') {
    const order = get<any>('SELECT establishment_id FROM orders WHERE id=?', p.order_id);
    if (get<any>('SELECT owner_id FROM establishments WHERE id=?', order?.establishment_id)?.owner_id !== req.auth!.id) throw unauthorized();
  }
  if (p.status === 'approved') return res.json({ ok: true, payment: publicPayment(p) });
  if (p.status !== 'pending') throw conflict('Este pagamento não está pendente.');
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

// Bloqueados até integração, conciliação e testes com o provedor escolhido.
// Não registrar estorno como realizado sem confirmação financeira externa.
paymentsRouter.post('/:id/refund', authenticate, requireRole('admin'), asyncRoute((_req, _res) => {
  throw conflict('Estornos automáticos ainda não estão disponíveis. Faça o processo pelo provedor e concilie manualmente.', 'refund_not_available');
}));
webhookRouter.post('/:provider', asyncRoute((_req, _res) => {
  throw conflict('Integração de webhooks ainda não está habilitada.', 'webhook_not_available');
}));

function publicPayment(p: any) {
  return { id: p.id, provider: p.provider, providerPaymentId: p.provider_payment_id, method: p.method, status: p.status,
    amountCents: p.amount_cents, createdAt: p.created_at, updatedAt: p.updated_at };
}
