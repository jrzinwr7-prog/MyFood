import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../../core/auth.js';
import { asyncRoute } from '../../core/http.js';
import { bad, conflict, notFound } from '../../core/errors.js';
import { all, get, run, audit, setting, setSetting } from '../../db/index.js';
import { now, uid } from '../../core/utils.js';
import { notify } from '../../core/notifications.js';
import { transitionOrder } from '../orders/service.js';

export const adminRouter = Router();
adminRouter.use(authenticate, requireRole('admin'));

adminRouter.get('/dashboard', asyncRoute((_req, res) => {
  const count = (sql: string, ...p: any[]) => get<{ n: number }>(sql, ...p)?.n ?? 0;
  const sum = (sql: string, ...p: any[]) => get<{ s: number }>(sql, ...p)?.s ?? 0;
  res.json({
    users: {
      consumers: count("SELECT COUNT(*) n FROM users WHERE role='consumer'"),
      merchants: count("SELECT COUNT(*) n FROM users WHERE role='merchant'"),
      couriers: count("SELECT COUNT(*) n FROM users WHERE role='courier'"),
      pendingMerchants: count("SELECT COUNT(*) n FROM establishments WHERE status='pending'"),
      pendingCouriers: count("SELECT COUNT(*) n FROM couriers WHERE status='pending'"),
    },
    orders: {
      total: count('SELECT COUNT(*) n FROM orders'),
      active: count("SELECT COUNT(*) n FROM orders WHERE status IN ('placed','awaiting_confirmation','accepted','preparing','awaiting_courier','courier_to_store','picked_up','on_the_way')"),
      completed: count("SELECT COUNT(*) n FROM orders WHERE status='delivered'"),
      cancelled: count("SELECT COUNT(*) n FROM orders WHERE status='cancelled'"),
      gmvCents: sum("SELECT COALESCE(SUM(total_cents),0) s FROM orders WHERE status NOT IN ('cancelled','failed')"),
      commissionCents: sum('SELECT COALESCE(SUM(platform_revenue_cents),0) s FROM commissions'),
    },
    topEstablishments: all<any>(`SELECT e.name, COUNT(o.id) orders, COALESCE(SUM(o.total_cents),0) revenue FROM establishments e
      LEFT JOIN orders o ON o.establishment_id=e.id GROUP BY e.id ORDER BY orders DESC LIMIT 10`),
    topProducts: all<any>(`SELECT name_snapshot name, SUM(quantity) qty FROM order_items GROUP BY product_id,name_snapshot ORDER BY qty DESC LIMIT 10`),
    growth: all<any>(`SELECT date(created_at) day, COUNT(*) orders, SUM(total_cents) revenue FROM orders GROUP BY date(created_at) ORDER BY day DESC LIMIT 30`),
  });
}));

adminRouter.get('/establishments', asyncRoute((req, res) => {
  const status = String(req.query.status ?? '');
  res.json({ items: all<any>(`SELECT e.*, u.name owner_name, u.email owner_email, u.status owner_status FROM establishments e
    JOIN users u ON u.id=e.owner_id ${status ? 'WHERE e.status=?' : ''} ORDER BY e.created_at DESC`, ...(status ? [status] : [])) });
}));
adminRouter.patch('/establishments/:id', asyncRoute((req, res) => {
  const b = z.object({ status: z.enum(['approved', 'rejected', 'suspended', 'pending']),
    reason: z.string().max(500).optional(), featured: z.boolean().optional(),
    commissionProductsBps: z.number().int().min(0).max(5000).optional(),
    commissionDeliveryBps: z.number().int().min(0).max(5000).optional() }).parse(req.body);
  const est = get<any>('SELECT * FROM establishments WHERE id=?', req.params.id);
  if (!est) throw notFound('Estabelecimento não encontrado');
  if (b.status === 'approved' && b.commissionProductsBps === undefined && b.commissionDeliveryBps === undefined) {
    const d = setting('commissions', { productsBps: 800, deliveryBps: 800 });
    run('UPDATE establishments SET commission_products_bps=?, commission_delivery_bps=? WHERE id=?', d.productsBps, d.deliveryBps, est.id);
  }
  if (b.commissionProductsBps !== undefined) run('UPDATE establishments SET commission_products_bps=? WHERE id=?', b.commissionProductsBps, est.id);
  if (b.commissionDeliveryBps !== undefined) run('UPDATE establishments SET commission_delivery_bps=? WHERE id=?', b.commissionDeliveryBps, est.id);
  run(`UPDATE establishments SET status=?, rejection_reason=?, approved_at=CASE WHEN ?='approved' THEN ? ELSE approved_at END WHERE id=?`,
    b.status, b.reason ?? null, b.status, now(), est.id);
  if (b.featured !== undefined) setSetting('featured', { ...setting('featured', []), [est.id]: b.featured });
  audit(req.auth!.id, 'admin', `establishment.${b.status}`, 'establishment', est.id, b, req.ip);
  notify(est.owner_id, `establishment:${b.status}`, 'Atualização do cadastro',
    b.status === 'approved' ? 'Seu estabelecimento foi aprovado e já pode receber pedidos!'
      : b.status === 'rejected' ? `Cadastro recusado: ${b.reason ?? 'entre em contato com o suporte'}` : `Status do estabelecimento: ${b.status}`, { establishmentId: est.id });
  res.json({ ok: true });
}));

adminRouter.get('/couriers', asyncRoute((req, res) => {
  res.json({ items: all<any>(`SELECT c.*, u.name, u.email, u.phone, u.status user_status FROM couriers c JOIN users u ON u.id=c.user_id ORDER BY c.created_at DESC`) });
}));
adminRouter.patch('/couriers/:id', asyncRoute((req, res) => {
  const b = z.object({ status: z.enum(['approved', 'rejected', 'suspended', 'pending']), reason: z.string().max(500).optional() }).parse(req.body);
  const c = get<any>('SELECT * FROM couriers WHERE id=?', req.params.id);
  if (!c) throw notFound('Entregador não encontrado');
  run('UPDATE couriers SET status=?, rejection_reason=?, approved_at=CASE WHEN ?=\'approved\' THEN ? ELSE approved_at END WHERE id=?',
    b.status, b.reason ?? null, b.status, now(), c.id);
  if (b.status === 'suspended') run('UPDATE couriers SET online=0 WHERE id=?', c.id);
  audit(req.auth!.id, 'admin', `courier.${b.status}`, 'courier', c.id, b, req.ip);
  notify(c.user_id, `courier:${b.status}`, 'Atualização do cadastro', `Status do seu cadastro de entregador: ${b.status}`, { courierId: c.id });
  res.json({ ok: true });
}));

adminRouter.get('/users', asyncRoute((req, res) => {
  const role = String(req.query.role ?? ''); const q = String(req.query.q ?? '');
  res.json({ items: all<any>(`SELECT id,name,email,phone,role,status,created_at FROM users
    ${role ? 'WHERE role=?' : ''} ${q ? (role ? 'AND' : 'WHERE') + ' (name LIKE ? OR email LIKE ?)' : ''} ORDER BY created_at DESC LIMIT 200`,
    ...(role ? [role] : []), ...(q ? [`%${q}%`, `%${q}%`] : [])) });
}));
adminRouter.patch('/users/:id', asyncRoute((req, res) => {
  const b = z.object({ status: z.enum(['active', 'suspended']) }).parse(req.body);
  const user = get<any>('SELECT * FROM users WHERE id=?', req.params.id);
  if (!user) throw notFound('Usuário não encontrado');
  if (user.role === 'admin' && b.status === 'suspended') throw bad('Não é possível suspender outro administrador');
  run('UPDATE users SET status=? WHERE id=?', b.status, user.id);
  if (user.role === 'courier' && b.status === 'suspended') run('UPDATE couriers SET online=0 WHERE user_id=?', user.id);
  audit(req.auth!.id, 'admin', `user.${b.status}`, 'user', user.id, {}, req.ip);
  res.json({ ok: true });
}));

adminRouter.get('/orders', asyncRoute((req, res) => {
  const status = String(req.query.status ?? '');
  res.json({ items: all<any>(`SELECT o.*, u.name customer_name, e.name establishment_name FROM orders o
    JOIN users u ON u.id=o.customer_id JOIN establishments e ON e.id=o.establishment_id
    ${status ? 'WHERE o.status=?' : ''} ORDER BY o.created_at DESC LIMIT 200`, ...(status ? [status] : [])) });
}));
adminRouter.post('/orders/:id/status', asyncRoute((req, res) => {
  const b = z.object({ status: z.enum(['accepted', 'preparing', 'awaiting_courier', 'courier_to_store', 'picked_up', 'on_the_way', 'delivered', 'cancelled', 'failed']),
    reason: z.string().max(300).optional() }).parse(req.body);
  res.json({ order: transitionOrder(req.params.id, b.status, req.auth!.id, 'admin', b.reason) });
}));

adminRouter.get('/finance', asyncRoute((_req, res) => {
  res.json({
    commissions: all<any>('SELECT c.*, o.id order_id, o.created_at FROM commissions c JOIN orders o ON o.id=c.order_id ORDER BY c.created_at DESC LIMIT 200'),
    payouts: all<any>('SELECT * FROM payouts ORDER BY created_at DESC LIMIT 200'),
    refunds: all<any>('SELECT * FROM refunds ORDER BY created_at DESC LIMIT 200'),
    transactions: all<any>('SELECT * FROM transactions ORDER BY created_at DESC LIMIT 200'),
    totals: get<any>(`SELECT COALESCE(SUM(platform_revenue_cents),0) revenue, COALESCE(SUM(product_commission_cents),0) product_commission,
      COALESCE(SUM(delivery_commission_cents),0) delivery_commission, COALESCE(SUM(courier_payout_cents),0) courier_due,
      COALESCE(SUM(merchant_payout_cents),0) merchant_due FROM commissions`),
  });
}));
adminRouter.post('/payouts/:id/paid', asyncRoute((req, res) => {
  const b = z.object({ externalId: z.string().min(1) }).parse(req.body);
  const p = get<any>('SELECT * FROM payouts WHERE id=?', req.params.id);
  if (!p) throw notFound('Repasse não encontrado');
  run('UPDATE payouts SET status=\'paid\', external_id=? WHERE id=?', b.externalId, p.id);
  audit(req.auth!.id, 'admin', 'payout.paid', 'payout', p.id, b, req.ip);
  res.json({ ok: true });
}));
adminRouter.get('/audit', asyncRoute((req, res) => {
  res.json({ items: all('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 300') });
}));

adminRouter.get('/settings', asyncRoute((_req, res) => {
  const rows = all<any>('SELECT * FROM app_settings');
  res.json({ settings: Object.fromEntries(rows.map(r => [r.key, JSON.parse(r.value)])),
    defaults: { commissions: { productsBps: 800, deliveryBps: 800 }, city: 'Lapão', states: ['BA'] } });
}));
adminRouter.patch('/settings', asyncRoute((req, res) => {
  const b = z.object({
    commissions: z.object({ productsBps: z.number().int().min(0).max(5000), deliveryBps: z.number().int().min(0).max(5000) }).optional(),
    city: z.string().min(1).optional(), states: z.array(z.string().length(2)).optional(),
    banners: z.array(z.object({ title: z.string(), subtitle: z.string().optional(), imageUrl: z.string(), href: z.string().optional() })).optional(),
    featured: z.record(z.boolean()).optional(), deliveryRules: z.object({ maxRadiusKm: z.number(), baseFeeCents: z.number() }).optional(),
    policies: z.object({ termsUrl: z.string().optional(), privacyUrl: z.string().optional() }).optional(),
    cashEnabled: z.boolean().optional(),
  }).parse(req.body);
  const before = Object.fromEntries(all<any>('SELECT * FROM app_settings').map(r => [r.key, JSON.parse(r.value)]));
  for (const [k, v] of Object.entries(b)) if (v !== undefined) setSetting(k, v);
  if (b.commissions) run('UPDATE establishments SET commission_products_bps=?, commission_delivery_bps=? WHERE commission_products_bps=800 AND commission_delivery_bps=800',
    b.commissions.productsBps, b.commissions.deliveryBps);
  audit(req.auth!.id, 'admin', 'settings.updated', 'settings', null, { before, after: b }, req.ip);
  res.json({ ok: true });
}));

adminRouter.get('/categories', asyncRoute((_req, res) => {
  res.json({ items: all('SELECT * FROM categories ORDER BY sort_order,name') });
}));
adminRouter.post('/categories', asyncRoute((req, res) => {
  const b = z.object({ name: z.string().min(2).max(60), icon: z.string().max(50).default('utensils'),
    active: z.boolean().default(true), sortOrder: z.number().int().default(0) }).parse(req.body);
  const slug = b.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (get('SELECT id FROM categories WHERE slug=?', slug)) throw conflict('Categoria já existe');
  const id = uid('cat_');
  run('INSERT INTO categories (id,name,slug,icon,active,sort_order) VALUES (?,?,?,?,?,?)', id, b.name, slug, b.icon, b.active ? 1 : 0, b.sortOrder);
  res.status(201).json({ category: get('SELECT * FROM categories WHERE id=?', id) });
}));
adminRouter.patch('/categories/:id', asyncRoute((req, res) => {
  const b = z.object({ name: z.string().min(2).max(60).optional(), icon: z.string().max(50).optional(),
    active: z.boolean().optional(), sortOrder: z.number().int().optional() }).parse(req.body);
  const entries = Object.entries(b);
  if (entries.length) run(`UPDATE categories SET ${entries.map(([k]) => `${k === 'active' ? 'active' : k === 'sortOrder' ? 'sort_order' : k}=?`).join(',')} WHERE id=?`,
    ...entries.map(([, v]) => typeof v === 'boolean' ? (v ? 1 : 0) : v), req.params.id);
  res.json({ ok: true });
}));
adminRouter.delete('/categories/:id', asyncRoute((req, res) => {
  run('UPDATE categories SET active=0 WHERE id=?', req.params.id);
  res.json({ ok: true });
}));
