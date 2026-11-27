import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../../core/auth.js';
import { asyncRoute } from '../../core/http.js';
import { bad, notFound } from '../../core/errors.js';
import { all, get, run, tx } from '../../db/index.js';
import { now, uid } from '../../core/utils.js';

export const productsRouter = Router();
productsRouter.use(authenticate, requireRole('merchant'));

const optionGroupSchema = z.object({
  id: z.string().optional(), name: z.string().min(1).max(80), minSelected: z.number().int().min(0).default(0),
  maxSelected: z.number().int().min(1).max(50).default(1), sortOrder: z.number().int().default(0),
  options: z.array(z.object({ id: z.string().optional(), name: z.string().min(1).max(80),
    priceCents: z.number().int().min(0), available: z.boolean().default(true) })).max(50).default([]),
});
const productSchema = z.object({
  name: z.string().min(1).max(120), description: z.string().max(1000).default(''),
  priceCents: z.number().int().min(0), categoryId: z.string().nullable().optional(),
  imageUrl: z.string().max(1000).nullable().optional(), available: z.boolean().default(true),
  sortOrder: z.number().int().default(0), prepMinutes: z.number().int().min(0).default(0),
  groups: z.array(optionGroupSchema).max(20).default([]),
});

function ownId(req: any) {
  const est = get<any>('SELECT id FROM establishments WHERE owner_id=?', req.auth!.id);
  if (!est) throw notFound('Estabelecimento não encontrado');
  return est.id as string;
}
function ownProduct(id: string, estId: string) {
  const p = get<any>('SELECT * FROM products WHERE id=? AND establishment_id=?', id, estId);
  if (!p) throw notFound('Produto não encontrado');
  return p;
}
function withGroups(p: any) {
  return { ...p, available: !!p.available, groups: all<any>('SELECT * FROM product_option_groups WHERE product_id=? ORDER BY sort_order,name', p.id)
    .map(g => ({ ...g, options: all<any>('SELECT * FROM product_options WHERE group_id=? ORDER BY name', g.id)
      .map(o => ({ ...o, available: !!o.available })) })) };
}

productsRouter.get('/', asyncRoute((req, res) => {
  const rows = all<any>('SELECT * FROM products WHERE establishment_id=? ORDER BY sort_order,name', ownId(req));
  res.json({ items: rows.map(withGroups) });
}));
productsRouter.post('/', asyncRoute((req, res) => {
  const b = productSchema.parse(req.body); const estId = ownId(req); const id = uid('prd_');
  tx(() => {
    run(`INSERT INTO products (id,establishment_id,category_id,name,description,price_cents,image_url,available,sort_order,prep_minutes,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`, id, estId, b.categoryId ?? null, b.name, b.description, b.priceCents, b.imageUrl ?? null,
      b.available ? 1 : 0, b.sortOrder, b.prepMinutes, now());
    saveGroups(id, b.groups);
  });
  res.status(201).json({ product: withGroups(get<any>('SELECT * FROM products WHERE id=?', id)) });
}));
productsRouter.patch('/:id', asyncRoute((req, res) => {
  const estId = ownId(req); ownProduct(req.params.id, estId);
  const b = productSchema.partial().parse(req.body);
  tx(() => {
    const fields: string[] = []; const params: any[] = [];
    const map: Record<string, string> = { priceCents: 'price_cents', categoryId: 'category_id', imageUrl: 'image_url',
      sortOrder: 'sort_order', prepMinutes: 'prep_minutes' };
    for (const [k, v] of Object.entries(b)) {
      if (k === 'groups') continue;
      fields.push(`${map[k] ?? k}=?`); params.push(typeof v === 'boolean' ? (v ? 1 : 0) : v);
    }
    if (fields.length) run(`UPDATE products SET ${fields.join(',')} WHERE id=? AND establishment_id=?`, ...params, req.params.id, estId);
    if (b.groups) saveGroups(req.params.id, b.groups);
  });
  res.json({ product: withGroups(get<any>('SELECT * FROM products WHERE id=?', req.params.id)) });
}));
productsRouter.delete('/:id', asyncRoute((req, res) => {
  const estId = ownId(req); ownProduct(req.params.id, estId);
  tx(() => {
    run('DELETE FROM product_options WHERE group_id IN (SELECT id FROM product_option_groups WHERE product_id=?)', req.params.id);
    run('DELETE FROM product_option_groups WHERE product_id=?', req.params.id);
    run('DELETE FROM products WHERE id=? AND establishment_id=?', req.params.id, estId);
  });
  res.json({ ok: true });
}));
productsRouter.patch('/:id/availability', asyncRoute((req, res) => {
  const estId = ownId(req); ownProduct(req.params.id, estId);
  const b = z.object({ available: z.boolean() }).parse(req.body);
  run('UPDATE products SET available=? WHERE id=? AND establishment_id=?', b.available ? 1 : 0, req.params.id, estId);
  res.json({ ok: true });
}));
productsRouter.post('/reorder', asyncRoute((req, res) => {
  const estId = ownId(req);
  const b = z.object({ items: z.array(z.object({ id: z.string(), sortOrder: z.number().int() })) }).parse(req.body);
  tx(() => b.items.forEach(i => run('UPDATE products SET sort_order=? WHERE id=? AND establishment_id=?', i.sortOrder, i.id, estId)));
  res.json({ ok: true });
}));

function saveGroups(productId: string, groups: z.infer<typeof optionGroupSchema>[]) {
  const existing = all<any>('SELECT id FROM product_option_groups WHERE product_id=?', productId).map(g => g.id);
  const keep = groups.filter(g => g.id && existing.includes(g.id)).map(g => g.id!);
  for (const id of existing.filter(id => !keep.includes(id))) {
    run('DELETE FROM product_options WHERE group_id=?', id);
    run('DELETE FROM product_option_groups WHERE id=?', id);
  }
  for (const g of groups) {
    const gid = g.id && keep.includes(g.id) ? g.id : uid('grp_');
    if (!g.id || !keep.includes(g.id))
      run('INSERT INTO product_option_groups (id,product_id,name,min_selected,max_selected,sort_order) VALUES (?,?,?,?,?,?)',
        gid, productId, g.name, g.minSelected, g.maxSelected, g.sortOrder);
    else run('UPDATE product_option_groups SET name=?,min_selected=?,max_selected=?,sort_order=? WHERE id=?',
      g.name, g.minSelected, g.maxSelected, g.sortOrder, gid);
    const oldOpts = all<any>('SELECT id FROM product_options WHERE group_id=?', gid).map(o => o.id);
    const keepOpts = g.options.filter(o => o.id && oldOpts.includes(o.id)).map(o => o.id!);
    for (const id of oldOpts.filter(id => !keepOpts.includes(id))) run('DELETE FROM product_options WHERE id=?', id);
    for (const o of g.options) {
      if (o.id && keepOpts.includes(o.id))
        run('UPDATE product_options SET name=?,price_cents=?,available=? WHERE id=?', o.name, o.priceCents, o.available ? 1 : 0, o.id);
      else run('INSERT INTO product_options (id,group_id,name,price_cents,available) VALUES (?,?,?,?,?)',
        uid('opt_'), gid, o.name, o.priceCents, o.available ? 1 : 0);
    }
  }
}
