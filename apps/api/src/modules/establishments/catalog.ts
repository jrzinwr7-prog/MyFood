import { Router } from 'express';
import { z } from 'zod';
import { all, get, setting } from '../../db/index.js';
import { asyncRoute } from '../../core/http.js';
import { bad, notFound } from '../../core/errors.js';
import { haversineKm, type Establishment, type Product } from '@myfood/shared';
import { config } from '../../core/config.js';
import { parseJson } from '../../core/utils.js';

export const catalogRouter = Router();

export type Hours = Record<string, { open: string; close: string; closed: boolean }>;
export function isOpenNow(establishmentId: string): boolean {
  const row = get<{ open_hours: string }>('SELECT open_hours FROM establishments WHERE id=?', establishmentId);
  if (!row) return false;
  const hours = parseJson<Hours>(row.open_hours, {});
  const parts = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Bahia', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(new Date());
  const dayMap: Record<string, string> = { dom: 'sun', seg: 'mon', ter: 'tue', qua: 'wed', qui: 'thu', sex: 'fri', sáb: 'sat' };
  const day = dayMap[parts.find(p => p.type === 'weekday')?.value.replace('.', '') ?? ''] ?? 'sun';
  const hhmm = `${parts.find(p => p.type === 'hour')?.value ?? '00'}:${parts.find(p => p.type === 'minute')?.value ?? '00'}`;
  const cfg = hours[day];
  if (!cfg || cfg.closed) return false;
  return hhmm >= cfg.open && hhmm <= cfg.close;
}

export function serializeEstablishment(row: any, coords?: { lat: number; lng: number }): any {
  const hours = parseJson<Hours>(row.open_hours, {});
  const stats = get<{ avg: number; count: number }>("SELECT AVG(rating) avg, COUNT(*) count FROM reviews WHERE target_type='establishment' AND target_id=?", row.id);
  return {
    id: row.id, ownerId: row.owner_id, name: row.name, slug: row.slug, description: row.description,
    categoryId: row.category_id, categoryName: row.category_name ?? null, logoUrl: row.logo_url, coverUrl: row.cover_url,
    phone: row.phone, cep: row.cep, street: row.street, number: row.number, complement: row.complement,
    neighborhood: row.neighborhood, city: row.city, state: row.state,
    latitude: row.latitude, longitude: row.longitude, deliveryFeeCents: row.delivery_fee_cents,
    minOrderCents: row.min_order_cents, prepTimeMin: row.prep_time_min, deliveryRadiusKm: row.delivery_radius_km,
    deliveryEnabled: !!row.delivery_enabled, pickupEnabled: !!row.pickup_enabled, status: row.status,
    openHours: hours, isOpen: isOpenNow(row.id), ratingAvg: Number(stats?.avg ?? 0), ratingCount: stats?.count ?? 0,
    distanceKm: coords && row.latitude && row.longitude ?
      Number(haversineKm(coords.lat, coords.lng, row.latitude, row.longitude).toFixed(1)) : undefined,
    createdAt: row.created_at,
  };
}

export function productsOf(establishmentId: string): any[] {
  const products = all<any>('SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.establishment_id=? AND p.available=1 ORDER BY p.sort_order, p.name', establishmentId);
  return products.map(p => {
    const groups = all<any>('SELECT * FROM product_option_groups WHERE product_id=? ORDER BY sort_order,name', p.id);
    return {
      id: p.id, establishmentId: p.establishment_id, categoryId: p.category_id, categoryName: p.category_name ?? null, name: p.name, description: p.description,
      priceCents: p.price_cents, imageUrl: p.image_url, available: !!p.available, sortOrder: p.sort_order, prepMinutes: p.prep_minutes,
      groups: groups.map(g => ({ id: g.id, name: g.name, minSelected: g.min_selected, maxSelected: g.max_selected,
        options: all<any>('SELECT * FROM product_options WHERE group_id=? AND available=1 ORDER BY name', g.id)
          .map(o => ({ id: o.id, name: o.name, priceCents: o.price_cents })) })),
    };
  });
}

catalogRouter.get('/public', asyncRoute((_req, res) => {
  res.json({ appName: 'FastDelivery', currency: 'BRL', locale: 'pt-BR', city: setting('city', 'Lapão'),
    states: setting('states', ['BA']), paymentsProvider: config.payments.provider,
    features: { pixManual: true, cash: true, onlineCards: false },
    privacyUrl: '/privacidade', termsUrl: '/termos' });
}));

catalogRouter.get('/categories', asyncRoute((_req, res) => {
  res.json({ items: all('SELECT * FROM categories WHERE active=1 ORDER BY sort_order,name') });
}));

catalogRouter.get('/establishments', asyncRoute((req, res) => {
  const q = String(req.query.q ?? '').trim();
  const category = String(req.query.category ?? '');
  const sort = String(req.query.sort ?? 'recommended');
  const openOnly = req.query.open === 'true';
  const lat = Number(req.query.lat), lng = Number(req.query.lng);
  const coords = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 ? { lat, lng } : undefined;
  const rows = all<any>(`SELECT e.*, c.name category_name FROM establishments e JOIN users u ON u.id=e.owner_id LEFT JOIN categories c ON c.id=e.category_id
    WHERE e.status='approved' AND u.status='active' ${q ? 'AND (e.name LIKE ? OR e.description LIKE ? OR c.name LIKE ?)' : ''}
    ${category ? 'AND e.category_id=?' : ''}`,
    ...(q ? [`%${q}%`, `%${q}%`, `%${q}%`] : []), ...(category ? [category] : []));
  let items = rows.map(r => serializeEstablishment(r, coords));
  if (openOnly) items = items.filter(i => i.isOpen);
  if (q && sort !== 'relevance') {
    const term = q.toLowerCase();
    items = items.filter(i => i.name.toLowerCase().includes(term) || i.description.toLowerCase().includes(term)
      || all<any>('SELECT name FROM products WHERE establishment_id=? AND available=1', i.id).some(p => p.name.toLowerCase().includes(term)));
  }
  if (coords) items = items.filter(i => i.distanceKm === undefined || i.distanceKm <= i.deliveryRadiusKm);
  if (sort === 'distance' && coords) items.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
  else if (sort === 'rating') items.sort((a, b) => b.ratingAvg - a.ratingAvg);
  else if (sort === 'fee') items.sort((a, b) => a.deliveryFeeCents - b.deliveryFeeCents);
  else {
    const featured = setting<Record<string, boolean>>('featured', {});
    items.sort((a, b) => Number(!!featured[b.id]) - Number(!!featured[a.id])
      || Number(b.isOpen) - Number(a.isOpen) || b.ratingAvg - a.ratingAvg);
  }
  res.json({ items });
}));

catalogRouter.get('/establishments/:slug', asyncRoute((req, res) => {
  const row = get<any>(`SELECT e.*, c.name category_name FROM establishments e LEFT JOIN categories c ON c.id=e.category_id
    WHERE e.slug=? AND e.status='approved'`, req.params.slug);
  if (!row) throw notFound('Estabelecimento não encontrado ou não disponível');
  const reviews = all<any>(`SELECT r.*, u.name author_name FROM reviews r JOIN users u ON u.id=r.author_id
    WHERE r.target_type='establishment' AND r.target_id=? ORDER BY r.created_at DESC LIMIT 30`, row.id);
  res.json({ establishment: serializeEstablishment(row), products: productsOf(row.id), reviews,
    favoritesCount: get<{ n: number }>('SELECT COUNT(*) n FROM favorites WHERE establishment_id=?', row.id)?.n ?? 0 });
}));

catalogRouter.get('/products/:id', asyncRoute((req, res) => {
  const p = get<any>('SELECT * FROM products WHERE id=? AND available=1', req.params.id);
  if (!p) throw notFound('Produto não encontrado');
  const est = get<any>('SELECT * FROM establishments WHERE id=? AND status=\'approved\'', p.establishment_id);
  if (!est) throw notFound('Produto indisponível');
  res.json({ product: productsOf(p.establishment_id).find(x => x.id === p.id) });
}));

catalogRouter.get('/banners', asyncRoute((_req, res) => {
  res.json({ items: setting('banners', []) });
}));

/** CEP: integração real com ViaCEP; falha é explícita (não inventa endereço). */
catalogRouter.get('/cep/:cep', asyncRoute(async (req, res) => {
  const cep = String(req.params.cep).replace(/\D/g, '');
  if (cep.length !== 8) throw bad('CEP inválido');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(`${config.maps.viacepUrl}/${cep}/json/`, { signal: controller.signal });
    if (!response.ok) throw bad('Serviço de CEP indisponível');
    const data: any = await response.json();
    if (data.erro) throw notFound('CEP não encontrado');
    res.json({ cep: data.cep, street: data.logradouro, neighborhood: data.bairro, city: data.localidade,
      state: data.uf, complement: data.complemento, ibge: data.ibge });
  } catch (error: any) {
    if (error instanceof Error && error.message === 'Serviço de CEP indisponível') throw error;
    throw bad('Não foi possível consultar o CEP agora. Verifique a conexão e tente novamente.', 'cep_unavailable');
  } finally { clearTimeout(timeout); }
}));
