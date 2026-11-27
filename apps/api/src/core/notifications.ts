import { emit } from '../realtime/index.js';
import { get, run } from '../db/index.js';
import { json, now, uid } from './utils.js';

export function notify(userId: string | null | undefined, type: string, title: string, body: string, data: unknown = {}) {
  if (!userId) return;
  const id = uid();
  run('INSERT INTO notifications (id,user_id,type,title,body,data,created_at) VALUES (?,?,?,?,?,?,?)',
    id, userId, type, title, body, json(data), now());
  const row = get<{ id: string; type: string; title: string; body: string; data: string; read_at: string | null; created_at: string }>(
    'SELECT * FROM notifications WHERE id=?', id);
  emit(userId, 'notification', row);
  // Push externo ainda não foi implementado; ver docs/PRONTIDAO-INTEGRACOES.md.
}
