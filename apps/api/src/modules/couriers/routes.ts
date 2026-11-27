import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../../core/auth.js';
import { asyncRoute } from '../../core/http.js';
import { conflict, notFound, unauthorized } from '../../core/errors.js';
import { all, get, run, tx } from '../../db/index.js';
import { haversineKm } from '@myfood/shared';
import { now, uid } from '../../core/utils.js';
import { notify } from '../../core/notifications.js';
import { emit, emitMany } from '../../realtime/index.js';
import { transitionOrder, orderActors } from '../orders/service.js';

export const couriersRouter = Router();
couriersRouter.use(authenticate, requireRole('courier'));

function myCourier(userId: string) {
  const c = get<any>('SELECT * FROM couriers WHERE user_id=?', userId);
  if (!c) throw notFound('Cadastro de entregador não encontrado');
  return c;
}

couriersRouter.get('/me', asyncRoute((req, res) => {
  const c = myCourier(req.auth!.id);
  res.json({ courier: { ...c, online: !!c.online }, user: get<any>('SELECT id,name,email,phone,status FROM users WHERE id=?', req.auth!.id) });
}));
couriersRouter.patch('/me', asyncRoute((req, res) => {
  const c = myCourier(req.auth!.id);
  const b = z.object({ online: z.boolean().optional(), latitude: z.number().min(-90).max(90).optional().nullable(),
    longitude: z.number().min(-180).max(180).optional().nullable(), vehicle: z.enum(['bicycle','motorcycle','car']).optional(),
    vehiclePlate: z.string().max(10).optional().nullable(), bankInfo: z.string().max(300).optional().nullable() }).parse(req.body);
  const entries = Object.entries(b).filter(([, v]) => v !== undefined);
  if (entries.length) run(`UPDATE couriers SET ${entries.map(([k]) => `${k}=?`).join(',')} WHERE id=?`,
    ...entries.map(([, v]) => typeof v === 'boolean' ? (v ? 1 : 0) : v), c.id);
  res.json({ courier: get<any>('SELECT * FROM couriers WHERE id=?', c.id) });
}));

couriersRouter.get('/offers', asyncRoute((req, res) => {
  const c = myCourier(req.auth!.id);
  const offers = all<any>(`SELECT d.*, o.status order_status, o.created_at order_date, e.name establishment_name,
    e.street pickup_street, e.number pickup_number, e.neighborhood pickup_neighborhood, e.latitude pickup_lat, e.longitude pickup_lng
    FROM deliveries d JOIN orders o ON o.id=d.order_id JOIN establishments e ON e.id=o.establishment_id
    WHERE d.courier_id IS NULL AND d.status IN ('offered','awaiting_courier') AND o.status='awaiting_courier'
    ORDER BY d.offered_at DESC LIMIT 50`)
    .map(d => ({ ...d,
      distanceKm: c.latitude && c.longitude && d.pickup_lat && d.pickup_lng
        ? Number(haversineKm(c.latitude, c.longitude, d.pickup_lat, d.pickup_lng).toFixed(2)) : null }));
  res.json({ items: offers });
}));

couriersRouter.post('/offers/:id/accept', asyncRoute((req, res) => {
  const c = myCourier(req.auth!.id);
  if (c.status !== 'approved') throw unauthorized('Cadastro ainda não aprovado');
  if (!c.online) throw conflict('Fique online para aceitar entregas');
  const delivery = get<any>('SELECT * FROM deliveries WHERE id=?', req.params.id);
  if (!delivery) throw notFound('Solicitação não encontrada');
  const accepted = tx(() => {
    const result = run(`UPDATE deliveries SET courier_id=?, status='accepted', accepted_at=?, version=version+1
      WHERE id=? AND courier_id IS NULL AND status IN ('offered','awaiting_courier','not_requested')`, c.id, now(), delivery.id);
    if (!result.changes) throw conflict('Entrega já foi designada a outro entregador');
    const order = get<any>('SELECT status FROM orders WHERE id=?', delivery.order_id)!;
    if (order.status === 'awaiting_courier') transitionOrder(delivery.order_id, 'courier_to_store', req.auth!.id, 'courier');
    const convId = uid('cnv_');
    const actors = orderActors(delivery.order_id);
    run('INSERT INTO conversations (id,order_id,type,customer_id,merchant_id,courier_id,establishment_id,created_at) VALUES (?,?,?,?,?,?,?,?)',
      convId, delivery.order_id, 'customer_courier', actors.customer_id, actors.merchant_user_id, req.auth!.id,
      get<any>('SELECT establishment_id FROM orders WHERE id=?', delivery.order_id)?.establishment_id, now());
    run('INSERT INTO conversations (id,order_id,type,merchant_id,courier_id,establishment_id,created_at) VALUES (?,?,?,?,?,?,?)',
      uid('cnv_'), delivery.order_id, 'merchant_courier', actors.merchant_user_id, req.auth!.id,
      get<any>('SELECT establishment_id FROM orders WHERE id=?', delivery.order_id)?.establishment_id, now());
    return get<any>('SELECT * FROM deliveries WHERE id=?', delivery.id)!;
  });
  const actors = orderActors(delivery.order_id);
  notify(actors.merchant_user_id, 'delivery:assigned', 'Entregador designado', 'Um entregador aceitou a solicitação.', { orderId: delivery.order_id });
  notify(actors.customer_id, 'delivery:assigned', 'Entregador a caminho', 'Um entregador está indo retirar seu pedido.', { orderId: delivery.order_id });
  emitMany([actors.customer_id, actors.merchant_user_id], 'delivery:updated', { deliveryId: delivery.id, status: 'accepted' });
  res.json({ delivery: accepted });
}));

couriersRouter.post('/offers/:id/reject', asyncRoute((req, res) => {
  const c = myCourier(req.auth!.id);
  const d = get<any>('SELECT * FROM deliveries WHERE id=?', req.params.id);
  if (!d) throw notFound('Solicitação não encontrada');
  const actors = orderActors(d.order_id);
  if (actors.merchant_user_id) notify(actors.merchant_user_id, 'delivery:rejected', 'Solicitação recusada', 'Um entregador recusou a corrida.', { orderId: d.order_id });
  res.json({ ok: true, courierId: c.id });
}));

couriersRouter.get('/deliveries', asyncRoute((req, res) => {
  const c = myCourier(req.auth!.id);
  const items = all<any>(`SELECT d.*, o.status order_status, o.total_cents, e.name establishment_name, e.street pickup_street,
    e.number pickup_number, e.neighborhood pickup_neighborhood, a.street dest_street, a.number dest_number,
    a.neighborhood dest_neighborhood, a.city dest_city, a.latitude dest_lat, a.longitude dest_lng
    FROM deliveries d JOIN orders o ON o.id=d.order_id JOIN establishments e ON e.id=o.establishment_id
    LEFT JOIN addresses a ON a.id=o.address_id WHERE d.courier_id=? ORDER BY d.created_at DESC LIMIT 100`, c.id);
  res.json({ items });
}));

function assertMine(courierId: string, deliveryId: string) {
  const d = get<any>('SELECT * FROM deliveries WHERE id=? AND courier_id=?', deliveryId, courierId);
  if (!d) throw notFound('Entrega não encontrada');
  return d;
}

couriersRouter.post('/deliveries/:id/picked', asyncRoute((req, res) => {
  const c = myCourier(req.auth!.id); assertMine(c.id, req.params.id);
  const d = get<any>('SELECT * FROM deliveries WHERE id=?', req.params.id)!;
  transitionOrder(d.order_id, 'picked_up', req.auth!.id, 'courier');
  run('UPDATE deliveries SET status=\'picked_up\', picked_at=? WHERE id=?', now(), d.id);
  const actors = orderActors(d.order_id);
  notify(actors.customer_id, 'order:picked_up', 'Pedido retirado', 'Seu pedido saiu do estabelecimento.', { orderId: d.order_id });
  res.json({ ok: true });
}));
couriersRouter.post('/deliveries/:id/depart', asyncRoute((req, res) => {
  const c = myCourier(req.auth!.id); assertMine(c.id, req.params.id);
  const d = get<any>('SELECT * FROM deliveries WHERE id=?', req.params.id)!;
  transitionOrder(d.order_id, 'on_the_way', req.auth!.id, 'courier');
  run('UPDATE deliveries SET status=\'on_the_way\' WHERE id=?', d.id);
  res.json({ ok: true });
}));
couriersRouter.post('/deliveries/:id/delivered', asyncRoute((req, res) => {
  const c = myCourier(req.auth!.id); assertMine(c.id, req.params.id);
  const d = get<any>('SELECT * FROM deliveries WHERE id=?', req.params.id)!;
  transitionOrder(d.order_id, 'delivered', req.auth!.id, 'courier');
  run('UPDATE deliveries SET status=\'delivered\', delivered_at=? WHERE id=?', now(), d.id);
  res.json({ ok: true });
}));
/** Localização compartilhada somente durante a entrega e apenas com participants do pedido. */
couriersRouter.post('/deliveries/:id/location', asyncRoute((req, res) => {
  const c = myCourier(req.auth!.id); const d = assertMine(c.id, req.params.id);
  const b = z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) }).parse(req.body);
  if (!['accepted', 'picked_up', 'on_the_way'].includes(d.status)) throw conflict('Compartilhamento disponível apenas durante a entrega');
  run('INSERT INTO delivery_locations (id,delivery_id,courier_id,latitude,longitude,created_at) VALUES (?,?,?,?,?,?)',
    uid(), d.id, c.id, b.latitude, b.longitude, now());
  run('UPDATE couriers SET latitude=?, longitude=? WHERE id=?', b.latitude, b.longitude, c.id);
  const actors = orderActors(d.order_id);
  emitMany([actors.customer_id, actors.merchant_user_id], 'delivery:location',
    { orderId: d.order_id, latitude: b.latitude, longitude: b.longitude });
  res.json({ ok: true });
}));

couriersRouter.get('/earnings', asyncRoute((req, res) => {
  const c = myCourier(req.auth!.id);
  res.json({ totals: get<any>(`SELECT COALESCE(SUM(amount_cents),0) earnings FROM payouts WHERE recipient_id=? AND recipient_type='courier' AND status!='cancelled'`, c.id),
    delivered: get<{ n: number }>("SELECT COUNT(*) n FROM deliveries WHERE courier_id=? AND status='delivered'", c.id)?.n ?? 0,
    payouts: all<any>("SELECT * FROM payouts WHERE recipient_id=? AND recipient_type='courier' ORDER BY created_at DESC LIMIT 100", c.id) });
}));
