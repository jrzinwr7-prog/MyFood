import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../core/auth.js';
import { asyncRoute } from '../../core/http.js';
import { bad, notFound, unauthorized } from '../../core/errors.js';
import { all, get, run } from '../../db/index.js';
import { now, uid } from '../../core/utils.js';
import { notify } from '../../core/notifications.js';
import { emit } from '../../realtime/index.js';

export const chatRouter = Router();
chatRouter.use(authenticate);

function ownedConversation(id: string, userId: string, role: string) {
  const c = get<any>('SELECT * FROM conversations WHERE id=?', id);
  if (!c) throw notFound('Conversa não encontrada');
  if (role === 'admin') return c;
  const isMember = c.customer_id === userId || c.merchant_id === userId || c.courier_id === userId;
  if (!isMember) throw unauthorized();
  return c;
}
function recipients(c: any, senderId: string): string[] {
  return [c.customer_id, c.merchant_id, c.courier_id].filter((id: string | null) => id && id !== senderId) as string[];
}

chatRouter.get('/conversations', asyncRoute((req, res) => {
  const me = req.auth!.id;
  const items = all<any>(`SELECT c.*, o.status order_status, e.name establishment_name,
    (SELECT body FROM messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC LIMIT 1) last_message,
    (SELECT created_at FROM messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC LIMIT 1) last_at,
    (SELECT COUNT(*) FROM messages m WHERE m.conversation_id=c.id AND m.sender_id!=? AND m.read_at IS NULL) unread
    FROM conversations c LEFT JOIN orders o ON o.id=c.order_id LEFT JOIN establishments e ON e.id=c.establishment_id
    WHERE c.customer_id=? OR c.merchant_id=? OR c.courier_id=? ORDER BY last_at DESC LIMIT 100`, me, me, me, me);
  res.json({ items });
}));

chatRouter.get('/conversations/:id/messages', asyncRoute((req, res) => {
  const c = ownedConversation(req.params.id, req.auth!.id, req.auth!.role);
  const items = all<any>(`SELECT m.*, u.name sender_name FROM messages m JOIN users u ON u.id=m.sender_id
    WHERE m.conversation_id=? ORDER BY m.created_at ASC LIMIT 500`, c.id);
  run('UPDATE messages SET read_at=? WHERE conversation_id=? AND sender_id!=? AND read_at IS NULL', now(), c.id, req.auth!.id);
  res.json({ conversation: c, items });
}));

chatRouter.post('/conversations/:id/messages', asyncRoute((req, res) => {
  const b = z.object({ body: z.string().trim().min(1).max(2000) }).parse(req.body);
  const c = ownedConversation(req.params.id, req.auth!.id, req.auth!.role);
  const id = uid('msg_'); const stamp = now();
  run('INSERT INTO messages (id,conversation_id,sender_id,body,created_at) VALUES (?,?,?,?,?)', id, c.id, req.auth!.id, b.body, stamp);
  const message = get<any>('SELECT m.*, u.name sender_name FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.id=?', id);
  const to = recipients(c, req.auth!.id);
  to.forEach(userId => {
    notify(userId, 'chat:message', 'Nova mensagem', `${req.auth!.name}: ${b.body.slice(0, 80)}`, { conversationId: c.id, orderId: c.order_id });
    emit(userId, 'message:new', { conversationId: c.id, message, orderId: c.order_id });
  });
  res.status(201).json({ message });
}));

/** Suporte e denúncias */
chatRouter.post('/support', asyncRoute((req, res) => {
  const b = z.object({ subject: z.string().min(3).max(120), body: z.string().min(10).max(2000) }).parse(req.body);
  const id = uid('tkt_');
  run('INSERT INTO support_tickets (id,user_id,subject,body,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
    id, req.auth!.id, b.subject, b.body, 'open', now(), now());
  const admins = all<any>("SELECT id FROM users WHERE role='admin'");
  admins.forEach(a => notify(a.id, 'support:new', 'Novo chamado de suporte', b.subject, { ticketId: id }));
  res.status(201).json({ ticket: get('SELECT * FROM support_tickets WHERE id=?', id) });
}));
chatRouter.get('/support', asyncRoute((req, res) => {
  const items = req.auth!.role === 'admin' ? all('SELECT * FROM support_tickets ORDER BY created_at DESC LIMIT 200')
    : all('SELECT * FROM support_tickets WHERE user_id=? ORDER BY created_at DESC LIMIT 100', req.auth!.id);
  res.json({ items });
}));
chatRouter.patch('/support/:id', asyncRoute((req, res) => {
  if (req.auth!.role !== 'admin') throw unauthorized();
  const b = z.object({ status: z.enum(['open', 'answered', 'closed']), response: z.string().max(2000).optional() }).parse(req.body);
  const t = get<any>('SELECT * FROM support_tickets WHERE id=?', req.params.id);
  if (!t) throw notFound('Chamado não encontrado');
  run('UPDATE support_tickets SET status=?, response=?, updated_at=? WHERE id=?', b.status, b.response ?? null, now(), t.id);
  notify(t.user_id, 'support:updated', 'Chamado atualizado', `Seu chamado foi marcado como ${b.status}.`, { ticketId: t.id });
  res.json({ ok: true });
}));
