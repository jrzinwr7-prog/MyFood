import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../../core/auth.js';
import { asyncRoute } from '../../core/http.js';
import { bad, conflict, notFound, unauthorized } from '../../core/errors.js';
import { all, get, run, tx, audit } from '../../db/index.js';
import { calculateCartTotals, haversineKm, ORDER_STATUS_LABELS } from '@myfood/shared';
import { now, uid, json } from '../../core/utils.js';
import { notify } from '../../core/notifications.js';
import { emitMany } from '../../realtime/index.js';
import { transitionOrder } from './service.js';
import { config } from '../../core/config.js';

export const ordersRouter = Router();
ordersRouter.use(authenticate);

const itemSchema = z.object({
  productId: z.string(), quantity: z.number().int().min(1).max(30),
  selectedOptions: z.array(z.object({ optionId: z.string() })).max(30).default([]),
  notes: z.string().max(300).nullable().optional(),
});
const createSchema = z.object({
  establishmentId: z.string(), addressId: z.string(), paymentMethod: z.enum(['pix', 'pix_manual', 'cash', 'credit_card', 'debit_card']),
  items: z.array(itemSchema).min(1), couponCode: z.string().max(30).optional(), notes: z.string().max(500).optional(),
});

ordersRouter.post('/', asyncRoute(async (req, res) => {
  const body = createSchema.parse(req.body);
  const est = get<any>("SELECT * FROM establishments WHERE id=? AND status='approved'", body.establishmentId);
  if (!est) throw notFound('Estabelecimento não disponível');
  const address = get<any>('SELECT * FROM addresses WHERE id=? AND user_id=?', body.addressId, req.auth!.id);
  if (!address) throw notFound('Endereço de entrega não encontrado');
  if (['credit_card', 'debit_card', 'pix'].includes(body.paymentMethod))
    throw bad('Pagamento online ainda não está disponível. Use PIX manual ou dinheiro na entrega.', 'payment_provider_not_configured');
  const cashSetting = get<{ value: string }>("SELECT value FROM app_settings WHERE key='cash_enabled'");
  if (body.paymentMethod === 'cash' && cashSetting && JSON.parse(cashSetting.value) === false)
    throw bad('Pagamento em dinheiro na entrega está desabilitado pela plataforma');
  if (address.latitude && address.longitude && est.latitude && est.longitude) {
    const distance = haversineKm(address.latitude, address.longitude, est.latitude, est.longitude);
    if (distance > est.delivery_radius_km) throw bad(`Endereço fora da área de entrega (${est.delivery_radius_km} km)`);
  }
  let createdOrderId = '';
  const priced = tx(() => {
    const lines: any[] = [];
    for (const item of body.items) {
      const product = get<any>('SELECT * FROM products WHERE id=? AND establishment_id=? AND available=1', item.productId, est.id);
      if (!product) throw bad(`Produto indisponível: ${item.productId}`);
      const selected = item.selectedOptions.map(o => {
        const opt = get<any>(`SELECT o.*, g.name group_name, g.id group_id, g.min_selected, g.max_selected
          FROM product_options o JOIN product_option_groups g ON g.id=o.group_id
          WHERE o.id=? AND o.available=1 AND g.product_id=?`, o.optionId, product.id);
        if (!opt) throw bad(`Adicional inválido para ${product.name}`);
        return opt;
      });
      const groups = all<any>('SELECT * FROM product_option_groups WHERE product_id=?', product.id);
      for (const g of groups) {
        const count = selected.filter(s => s.group_id === g.id).length;
        if (count < g.min_selected || count > g.max_selected)
          throw bad(`Selecione entre ${g.min_selected} e ${g.max_selected} opção(ões) de "${g.name}"`);
      }
      const options = selected.map(s => ({ groupName: s.group_name, optionName: s.name, priceCents: s.price_cents }));
      lines.push({ product, options, notes: item.notes ?? null, quantity: item.quantity,
        unitPriceCents: product.price_cents + options.reduce((s, o) => s + o.priceCents, 0) });
    }
    let coupon: any = null;
    if (body.couponCode) {
      coupon = get<any>('SELECT * FROM coupons WHERE UPPER(code)=UPPER(?) AND active=1', body.couponCode.trim());
      const nowIso = now();
      if (!coupon || (coupon.establishment_id && coupon.establishment_id !== est.id) ||
        (coupon.starts_at && coupon.starts_at > nowIso) || (coupon.ends_at && coupon.ends_at < nowIso) ||
        (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit))
        throw bad('Cupom inválido ou expirado');
    }
    const totals = calculateCartTotals({
      items: lines.map(l => ({ key: l.product.id, product_id: l.product.id, name: l.product.name,
        unit_price_cents: l.product.price_cents, quantity: l.quantity,
        options: l.options.map((o: any) => ({ group_name: o.groupName, option_name: o.optionName, price_cents: o.priceCents })),
        notes: l.notes, image_url: l.product.image_url })),
      deliveryFeeCents: est.delivery_fee_cents,
      coupon: coupon ? { kind: coupon.kind, value: coupon.value } : null });
    if (totals.subtotal_cents - totals.discount_cents < est.min_order_cents)
      throw bad(`Pedido mínimo de R$ ${(est.min_order_cents / 100).toFixed(2).replace('.', ',')}`);
    const id = uid('ord_'); createdOrderId = id; const stamp = now();
    run(`INSERT INTO orders (id,customer_id,establishment_id,address_id,coupon_id,status,subtotal_cents,discount_cents,delivery_fee_cents,total_cents,payment_method,payment_status,payment_provider,notes,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, id, req.auth!.id, est.id, address.id, coupon?.id ?? null, 'placed',
      totals.subtotal_cents, totals.discount_cents, totals.delivery_fee_cents, totals.total_cents, body.paymentMethod, 'pending',
      config.payments.provider, body.notes ?? null, stamp, stamp);
    for (const line of lines) {
      run(`INSERT INTO order_items (id,order_id,product_id,name_snapshot,unit_price_cents,quantity,options_snapshot,notes,total_cents) VALUES (?,?,?,?,?,?,?,?,?)`,
        uid(), id, line.product.id, line.product.name, line.unitPriceCents, line.quantity,
        json(line.options), line.notes, line.unitPriceCents * line.quantity);
    }
    run('INSERT INTO order_status_history (id,order_id,from_status,to_status,actor_id,created_at) VALUES (?,?,?,?,?,?)',
      uid(), id, null, 'placed', req.auth!.id, stamp);
    run(`INSERT INTO deliveries (id,order_id,status,fee_cents,created_at) VALUES (?,?,?,?,?)`,
      uid('del_'), id, 'not_requested', totals.delivery_fee_cents, stamp);
    const convId = uid('cnv_');
    run('INSERT INTO conversations (id,order_id,type,customer_id,merchant_id,establishment_id,created_at) VALUES (?,?,?,?,?,?,?)',
      convId, id, 'customer_merchant', req.auth!.id, est.owner_id, est.id, stamp);
    if (coupon) run('UPDATE coupons SET used_count=used_count+1 WHERE id=?', coupon.id);
    return { id, totals };
  });
  const actors = { customer: req.auth!.id, merchant: est.owner_id };
  notify(actors.merchant, 'order:new', 'Novo pedido recebido', `Pedido ${createdOrderId.slice(-6).toUpperCase()} — R$ ${(priced.totals.total_cents / 100).toFixed(2).replace('.', ',')}`, { orderId: createdOrderId });
  emitMany([actors.customer, actors.merchant], 'order:updated', { orderId: createdOrderId, status: 'placed' });
  audit(req.auth!.id, req.auth!.role, 'order.created', 'order', createdOrderId, { totalCents: priced.totals.total_cents }, req.ip);
  res.status(201).json({ order: { id: createdOrderId, status: 'placed', ...priced.totals }, message: 'Pedido realizado. Complete o pagamento.' });
}));

ordersRouter.get('/mine', asyncRoute((req, res) => {
  const items = all<any>(`SELECT o.*, e.name establishment_name, e.slug establishment_slug, e.logo_url,
    (SELECT COUNT(*) FROM order_items i WHERE i.order_id=o.id) item_count
    FROM orders o JOIN establishments e ON e.id=o.establishment_id WHERE o.customer_id=? ORDER BY o.created_at DESC LIMIT 100`, req.auth!.id)
    .map(o => ({ ...o, statusLabel: ORDER_STATUS_LABELS[o.status as keyof typeof ORDER_STATUS_LABELS] }));
  res.json({ items });
}));

ordersRouter.get('/:id', asyncRoute((req, res) => {
  const order = get<any>(`SELECT o.*, e.name establishment_name, e.slug establishment_slug, e.phone establishment_phone,
    e.logo_url, e.street establishment_street, e.number establishment_number, e.neighborhood establishment_neighborhood,
    u.name customer_name, u.phone customer_phone FROM orders o JOIN establishments e ON e.id=o.establishment_id
    JOIN users u ON u.id=o.customer_id WHERE o.id=?`, req.params.id);
  if (!order) throw notFound('Pedido não encontrado');
  const isOwner = order.customer_id === req.auth!.id;
  const isMerchant = get<any>('SELECT owner_id FROM establishments WHERE id=?', order.establishment_id)?.owner_id === req.auth!.id;
  const isCourier = !!get<any>(`SELECT d.id FROM deliveries d JOIN couriers c ON c.id=d.courier_id WHERE d.order_id=? AND c.user_id=?`, order.id, req.auth!.id);
  if (!isOwner && !isMerchant && !isCourier && req.auth!.role !== 'admin') throw unauthorized();
  const items = all<any>('SELECT * FROM order_items WHERE order_id=?', order.id).map(i => ({ ...i,
    selectedOptions: JSON.parse(i.options_snapshot ?? '[]') }));
  const history = all<any>('SELECT * FROM order_status_history WHERE order_id=? ORDER BY created_at', order.id);
  const delivery = get<any>(`SELECT d.*, c.user_id courier_user_id, u.name courier_name, u.phone courier_phone
    FROM deliveries d LEFT JOIN couriers c ON c.id=d.courier_id LEFT JOIN users u ON u.id=c.user_id WHERE d.order_id=?`, order.id);
  const address = get<any>('SELECT * FROM addresses WHERE id=?', order.address_id);
  const payment = get<any>('SELECT id,status,method,provider,amount_cents FROM payments WHERE order_id=?', order.id);
  // Endereço do consumidor nunca é exposto a outros estabelecimentos/entregadores além do necessário à entrega.
  const safeAddress = address && (isOwner || req.auth!.role === 'admin') ? address :
    address ? { neighborhood: address.neighborhood, city: address.city, state: address.state, label: address.label,
      street: address.street, number: address.number, complement: address.complement,
      latitude: isCourier ? address.latitude : undefined, longitude: isCourier ? address.longitude : undefined } : null;
  res.json({ order: { ...order, statusLabel: ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS] },
    items, history, delivery, address: safeAddress, payment,
    conversationId: get<any>("SELECT id FROM conversations WHERE order_id=? AND type='customer_merchant'", order.id)?.id });
}));

ordersRouter.post('/:id/cancel', asyncRoute((req, res) => {
  const body = z.object({ reason: z.string().min(3).max(300) }).parse(req.body);
  const order = get<any>('SELECT * FROM orders WHERE id=?', req.params.id);
  if (!order) throw notFound('Pedido não encontrado');
  const isOwner = order.customer_id === req.auth!.id;
  const isMerchant = get<any>('SELECT owner_id FROM establishments WHERE id=?', order.establishment_id)?.owner_id === req.auth!.id;
  if (!isOwner && !isMerchant && req.auth!.role !== 'admin') throw unauthorized();
  transitionOrder(order.id, 'cancelled', req.auth!.id, req.auth!.role, body.reason);
  const payment = get<any>('SELECT * FROM payments WHERE order_id=?', order.id);
  if (payment && ['approved', 'pending'].includes(payment.status)) {
    run('UPDATE payments SET status=\'refunded\', updated_at=? WHERE id=?', now(), payment.id);
    run('INSERT INTO refunds (id,payment_id,order_id,amount_cents,reason,status,created_at) VALUES (?,?,?,?,?,?,?)',
      uid(), payment.id, order.id, payment.amount_cents, body.reason, 'pending', now());
  }
  res.json({ ok: true });
}));

ordersRouter.post('/:id/review', asyncRoute((req, res) => {
  const body = z.object({ targetType: z.enum(['establishment', 'courier']), rating: z.number().int().min(1).max(5),
    comment: z.string().max(1000).default('') }).parse(req.body);
  const order = get<any>('SELECT * FROM orders WHERE id=? AND customer_id=?', req.params.id, req.auth!.id);
  if (!order) throw notFound('Pedido não encontrado');
  if (order.status !== 'delivered') throw conflict('Avaliações são permitidas apenas após a entrega');
  const targetId = body.targetType === 'establishment' ? order.establishment_id
    : get<any>('SELECT courier_id FROM deliveries WHERE order_id=?', order.id)?.courier_id;
  if (!targetId) throw notFound('Destino da avaliação não encontrado');
  if (get('SELECT id FROM reviews WHERE order_id=? AND target_type=? AND target_id=?', order.id, body.targetType, targetId))
    throw conflict('Você já avaliou este item');
  run('INSERT INTO reviews (id,order_id,author_id,target_type,target_id,rating,comment,created_at) VALUES (?,?,?,?,?,?,?,?)',
    uid(), order.id, req.auth!.id, body.targetType, targetId, body.rating, body.comment, now());
  if (body.targetType === 'courier') {
    run('UPDATE couriers SET rating_avg=(SELECT AVG(rating) FROM reviews WHERE target_type=\'courier\' AND target_id=?), rating_count=(SELECT COUNT(*) FROM reviews WHERE target_type=\'courier\' AND target_id=?) WHERE id=?',
      targetId, targetId, targetId);
  }
  res.status(201).json({ ok: true });
}));

ordersRouter.get('/:id/review', asyncRoute((req, res) => {
  res.json({ items: all('SELECT * FROM reviews WHERE order_id=?', req.params.id) });
}));

/** Favoritos */
ordersRouter.post('/favorites/:establishmentId', asyncRoute((req, res) => {
  const est = get('SELECT id FROM establishments WHERE id=?', req.params.establishmentId);
  if (!est) throw notFound('Estabelecimento não encontrado');
  const exists = get('SELECT 1 FROM favorites WHERE user_id=? AND establishment_id=?', req.auth!.id, req.params.establishmentId);
  if (exists) run('DELETE FROM favorites WHERE user_id=? AND establishment_id=?', req.auth!.id, req.params.establishmentId);
  else run('INSERT INTO favorites (user_id,establishment_id,created_at) VALUES (?,?,?)', req.auth!.id, req.params.establishmentId, now());
  res.json({ favorite: !exists });
}));
ordersRouter.get('/meta/favorites', asyncRoute((req, res) => {
  res.json({ items: all(`SELECT e.* FROM favorites f JOIN establishments e ON e.id=f.establishment_id WHERE f.user_id=? ORDER BY f.created_at DESC`, req.auth!.id) });
}));
