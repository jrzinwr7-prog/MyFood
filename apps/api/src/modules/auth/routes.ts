import { Router } from 'express';
import { z } from 'zod';
import { asyncRoute } from '../../core/http.js';
import { bad, conflict, notFound } from '../../core/errors.js';
import { authenticate, hashPassword, loginFailed, loginGuard, loginSuccess, optionalAuth, signToken, verifyPassword } from '../../core/auth.js';
import { all, get, run, tx, audit } from '../../db/index.js';
import { now, uid, json } from '../../core/utils.js';
import { notify } from '../../core/notifications.js';

export const authRouter = Router();

const baseUser = z.object({
  name: z.string().trim().min(2, 'Informe seu nome').max(120),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().min(10).max(20),
  password: z.string().min(8, 'A senha deve ter no mínimo 8 caracteres').max(128),
  lgpdConsent: z.literal(true, { errorMap: () => ({ message: 'É necessário aceitar a política de privacidade' }) }),
});

const addressSchema = z.object({
  cep: z.string().min(8).max(9), street: z.string().min(2), number: z.string().min(1),
  complement: z.string().optional().nullable(), neighborhood: z.string().min(1), city: z.string().min(1),
  state: z.string().min(2).max(2), latitude: z.number().optional().nullable(), longitude: z.number().optional().nullable(),
});

const registerSchema = baseUser.extend({
  role: z.enum(['consumer', 'merchant', 'courier']),
  establishment: z.object({
    name: z.string().trim().min(2).max(120), categoryId: z.string().min(1), document: z.string().min(11),
    description: z.string().max(1000).optional(), phone: z.string().min(10),
    address: addressSchema,
  }).optional(),
  courier: z.object({
    document: z.string().min(11), vehicle: z.enum(['bicycle', 'motorcycle', 'car']),
    vehiclePlate: z.string().max(10).optional(), bankInfo: z.string().max(300).optional(),
  }).optional(),
}).superRefine((v, ctx) => {
  if (v.role === 'merchant' && !v.establishment) ctx.addIssue({ code: 'custom', path: ['establishment'], message: 'Dados do estabelecimento obrigatórios' });
  if (v.role === 'courier' && !v.courier) ctx.addIssue({ code: 'custom', path: ['courier'], message: 'Dados do entregador obrigatórios' });
});

function slugify(text: string) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

authRouter.post('/register', asyncRoute(async (req, res) => {
  const body = registerSchema.parse(req.body);
  const email = body.email.trim().toLowerCase();
  if (get('SELECT id FROM users WHERE email=?', email)) throw conflict('Este e-mail já está cadastrado');
  const doc = body.role === 'merchant' ? body.establishment!.document : body.courier?.document;
  if (doc) {
    const table = body.role === 'merchant' ? 'establishments' : 'couriers';
    if (get(`SELECT id FROM ${table} WHERE document=?`, doc)) throw conflict('Documento já cadastrado');
  }
  const passwordHash = await hashPassword(body.password);
  const result = tx(() => {
    const id = uid('usr_'); const stamp = now();
    run('INSERT INTO users (id,name,email,phone,password_hash,role,lgpd_consent_at,created_at) VALUES (?,?,?,?,?,?,?,?)',
      id, body.name, email, body.phone, passwordHash, body.role, stamp, stamp);
    if (body.role === 'consumer' && body.establishment === undefined) {
      // Endereço opcional no cadastro; pode ser adicionado depois.
    }
    let establishmentId: string | undefined;
    if (body.role === 'merchant') {
      const e = body.establishment!;
      establishmentId = uid('est_');
      let slug = slugify(e.name) || 'estabelecimento';
      if (get('SELECT id FROM establishments WHERE slug=?', slug)) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
      const a = e.address;
      run(`INSERT INTO establishments (id,owner_id,name,slug,description,category_id,document,phone,email,cep,street,number,complement,neighborhood,city,state,latitude,longitude,status,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, establishmentId, id, e.name, slug, e.description ?? '', e.categoryId,
        e.document, e.phone, email, a.cep, a.street, a.number, a.complement ?? null, a.neighborhood, a.city, a.state,
        a.latitude ?? null, a.longitude ?? null, 'pending', stamp);
      audit(id, 'merchant', 'establishment.created', 'establishment', establishmentId, { name: e.name }, req.ip);
    }
    if (body.role === 'courier') {
      const c = body.courier!;
      run('INSERT INTO couriers (id,user_id,document,vehicle,vehicle_plate,bank_info,status,created_at) VALUES (?,?,?,?,?,?,?,?)',
        uid('cou_'), id, c.document, c.vehicle, c.vehiclePlate ?? null, c.bankInfo ?? null, 'pending', stamp);
      audit(id, 'courier', 'courier.created', 'user', id, {}, req.ip);
    }
    const admins = all("SELECT id FROM users WHERE role='admin' AND status='active'");
    admins.forEach(a => notify(a.id, 'review:pending', 'Novo cadastro pendente', `${body.name} aguardando aprovação.`, { role: body.role }));
    return { id, establishmentId };
  });
  const user = get<any>('SELECT * FROM users WHERE id=?', result.id)!;
  const establishment = result.establishmentId ? get<any>('SELECT * FROM establishments WHERE id=?', result.establishmentId) : null;
  const auth = { id: user.id, role: user.role, name: user.name, email: user.email, establishmentId: result.establishmentId };
  res.status(201).json({ token: await signToken(auth),
    user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, establishment },
    message: body.role === 'consumer' ? 'Conta criada com sucesso' : 'Cadastro enviado para análise da administradora' });
}));

authRouter.post('/login', asyncRoute(async (req, res) => {
  const body = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
  if (!loginGuard(req)) throw bad('Muitas tentativas. Tente novamente em 15 minutos.', 'rate_limited');
  const user = get<any>('SELECT * FROM users WHERE email=?', body.email.trim().toLowerCase());
  if (!user || user.status !== 'active' || !(await verifyPassword(body.password, user.password_hash))) {
    loginFailed(req); throw bad('E-mail ou senha incorretos', 'invalid_credentials');
  }
  loginSuccess(req);
  const establishment = user.role === 'merchant' ? get<any>('SELECT * FROM establishments WHERE owner_id=?', user.id) : null;
  const courier = user.role === 'courier' ? get<any>('SELECT * FROM couriers WHERE user_id=?', user.id) : null;
  const auth = { id: user.id, role: user.role, name: user.name, email: user.email, establishmentId: establishment?.id, courierId: courier?.id };
  audit(user.id, user.role, 'auth.login', 'user', user.id, {}, req.ip);
  res.json({ token: await signToken(auth), user: { id: user.id, name: user.name, email: user.email, phone: user.phone,
    role: user.role, avatarUrl: user.avatar_url, establishment, courier } });
}));

authRouter.get('/me', authenticate, asyncRoute(async (req, res) => {
  const user = get<any>('SELECT id,name,email,phone,role,avatar_url,status,lgpd_consent_at,created_at FROM users WHERE id=?', req.auth!.id);
  if (!user) throw notFound('Usuário não encontrado');
  const establishment = req.auth!.role === 'merchant' ? get<any>('SELECT * FROM establishments WHERE owner_id=?', user.id) : null;
  const courier = req.auth!.role === 'courier' ? get<any>('SELECT * FROM couriers WHERE user_id=?', user.id) : null;
  res.json({ user: { ...user, establishment, courier } });
}));

authRouter.patch('/me', authenticate, asyncRoute(async (req, res) => {
  const body = z.object({ name: z.string().min(2).max(120).optional(), phone: z.string().min(10).max(20).optional(),
    avatarUrl: z.string().max(500).nullable().optional() }).parse(req.body);
  const fields = Object.entries(body).filter(([, v]) => v !== undefined);
  if (fields.length) run(`UPDATE users SET ${fields.map(([k]) => k === 'avatarUrl' ? 'avatar_url' : k).map(k => `${k}=?`).join(',')} WHERE id=?`,
    ...fields.map(([, v]) => v), req.auth!.id);
  res.json({ user: get<any>('SELECT id,name,email,phone,role,avatar_url FROM users WHERE id=?', req.auth!.id) });
}));

authRouter.get('/notifications', authenticate, asyncRoute((req, res) => {
  res.json({ items: all('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100', req.auth!.id) });
}));
authRouter.patch('/notifications/read', authenticate, asyncRoute((req, res) => {
  const body = z.object({ id: z.string().optional(), all: z.boolean().optional() }).parse(req.body);
  if (body.all) run('UPDATE notifications SET read_at=? WHERE user_id=? AND read_at IS NULL', now(), req.auth!.id);
  else if (body.id) run('UPDATE notifications SET read_at=? WHERE id=? AND user_id=?', now(), body.id, req.auth!.id);
  res.json({ ok: true });
}));

/** LGPD: portabilidade e solicitação de exclusão (registradas em auditoria). */
authRouter.get('/lgpd/export', authenticate, asyncRoute((req, res) => {
  const id = req.auth!.id;
  const data = {
    user: get('SELECT id,name,email,phone,role,created_at,lgpd_consent_at FROM users WHERE id=?', id),
    addresses: all('SELECT * FROM addresses WHERE user_id=?', id),
    orders: all('SELECT * FROM orders WHERE customer_id=?', id),
    notifications: all('SELECT type,title,body,created_at FROM notifications WHERE user_id=?', id),
    reviews: all('SELECT * FROM reviews WHERE author_id=?', id),
  };
  audit(id, req.auth!.role, 'lgpd.export', 'user', id, {}, req.ip);
  res.json({ data });
}));
authRouter.post('/lgpd/delete-request', authenticate, asyncRoute((req, res) => {
  const body = z.object({ reason: z.string().min(5).max(500) }).parse(req.body);
  run('INSERT INTO support_tickets (id,user_id,subject,body,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
    uid(), req.auth!.id, 'LGPD — solicitação de exclusão de dados', body.reason, 'open', now(), now());
  audit(req.auth!.id, req.auth!.role, 'lgpd.delete_request', 'user', req.auth!.id, { reason: body.reason }, req.ip);
  res.status(202).json({ message: 'Solicitação registrada. O controlador responderá pelo e-mail cadastrado.' });
}));
