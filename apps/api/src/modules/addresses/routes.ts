import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../core/auth.js';
import { asyncRoute } from '../../core/http.js';
import { notFound } from '../../core/errors.js';
import { all, get, run } from '../../db/index.js';
import { now, uid } from '../../core/utils.js';

export const addressesRouter = Router();
addressesRouter.use(authenticate);

const schema = z.object({
  label: z.string().min(1).max(50), cep: z.string().min(8).max(9), street: z.string().min(2).max(200),
  number: z.string().min(1).max(20), complement: z.string().max(120).nullable().optional(),
  neighborhood: z.string().min(1).max(120), city: z.string().min(1).max(120), state: z.string().length(2),
  latitude: z.number().min(-90).max(90).nullable().optional(), longitude: z.number().min(-180).max(180).nullable().optional(),
  isDefault: z.boolean().optional(),
});

addressesRouter.get('/', asyncRoute((req, res) => {
  res.json({ items: all('SELECT * FROM addresses WHERE user_id=? ORDER BY is_default DESC, created_at DESC', req.auth!.id) });
}));
addressesRouter.post('/', asyncRoute((req, res) => {
  const b = schema.parse(req.body); const id = uid('addr_');
  const hasDefault = b.isDefault || !get('SELECT id FROM addresses WHERE user_id=?', req.auth!.id);
  if (hasDefault) run('UPDATE addresses SET is_default=0 WHERE user_id=?', req.auth!.id);
  run(`INSERT INTO addresses (id,user_id,label,cep,street,number,complement,neighborhood,city,state,latitude,longitude,is_default,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, id, req.auth!.id, b.label, b.cep, b.street, b.number, b.complement ?? null,
    b.neighborhood, b.city, b.state, b.latitude ?? null, b.longitude ?? null, hasDefault ? 1 : 0, now());
  res.status(201).json({ address: get('SELECT * FROM addresses WHERE id=?', id) });
}));
addressesRouter.patch('/:id', asyncRoute((req, res) => {
  const b = schema.partial().parse(req.body);
  const address = get<any>('SELECT * FROM addresses WHERE id=? AND user_id=?', req.params.id, req.auth!.id);
  if (!address) throw notFound('Endereço não encontrado');
  if (b.isDefault) run('UPDATE addresses SET is_default=0 WHERE user_id=?', req.auth!.id);
  const fields = Object.entries(b).map(([k]) => k === 'isDefault' ? 'is_default' : k === 'latitude' || k === 'longitude' ? k : k);
  if (fields.length) run(`UPDATE addresses SET ${fields.map(f => `${f}=?`).join(',')} WHERE id=?`,
    ...Object.entries(b).map(([, v]) => typeof v === 'boolean' ? (v ? 1 : 0) : v), req.params.id);
  res.json({ address: get('SELECT * FROM addresses WHERE id=?', req.params.id) });
}));
addressesRouter.delete('/:id', asyncRoute((req, res) => {
  const result = run('DELETE FROM addresses WHERE id=? AND user_id=?', req.params.id, req.auth!.id);
  if (!result.changes) throw notFound('Endereço não encontrado');
  res.json({ ok: true });
}));
