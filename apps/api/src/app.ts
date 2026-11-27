import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authRouter } from './modules/auth/routes.js';
import { catalogRouter } from './modules/establishments/catalog.js';
import { addressesRouter } from './modules/addresses/routes.js';
import { ordersRouter } from './modules/orders/routes.js';
import { merchantRouter } from './modules/establishments/merchant.js';
import { productsRouter } from './modules/products/routes.js';
import { couriersRouter } from './modules/couriers/routes.js';
import { adminRouter } from './modules/admin/routes.js';
import { chatRouter } from './modules/chat/routes.js';
import { paymentsRouter, webhookRouter } from './modules/payments/routes.js';
import { errorHandler } from './core/errors.js';
import { config } from './core/config.js';
import { audit } from './db/index.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Access-Control-Allow-Origin', config.publicOrigin);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  const hits = new Map<string, { count: number; reset: number }>();
  app.use('/api', (req, res, next) => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.reset < now) { hits.set(key, { count: 1, reset: now + 15 * 60_000 }); return next(); }
    entry.count++;
    if (entry.count > 600) return res.status(429).json({ error: 'Muitas requisições. Aguarde alguns minutos.', code: 'rate_limited' });
    next();
  });

  app.get('/health', (_req, res) => res.json({ ok: true, service: 'myfood-api', time: new Date().toISOString() }));

  // Webhook precisa do corpo cru para validar assinatura.
  app.use('/api/webhooks', express.raw({ type: '*/*', limit: '1mb' }), webhookRouter);
  app.use('/api', express.json({ limit: '2mb' }));
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api/')) audit(null, null, 'http.request', null, null, { method: req.method, path: req.path }, req.ip);
    next();
  });

  app.use('/api/auth', authRouter);
  app.use('/api/catalog', catalogRouter);
  app.use('/api/addresses', addressesRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/merchant', merchantRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/couriers', couriersRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/payments', paymentsRouter);

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint não encontrado', code: 'not_found' }));
  app.use(errorHandler);
  return app;
}
