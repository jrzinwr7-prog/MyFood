import path from 'node:path';

function int(value: string | undefined, fallback: number) { const n = Number(value); return Number.isFinite(n) && n > 0 ? n : fallback; }

export const config = {
  port: int(process.env.PORT, 4000),
  dbPath: process.env.DATABASE_PATH ?? path.resolve(process.cwd(), 'data/myfood.db'),
  jwtSecret: process.env.JWT_SECRET ?? 'development-only-secret-change-in-production',
  jwtTtlSeconds: int(process.env.JWT_TTL_SECONDS, 60 * 60 * 24 * 7),
  publicOrigin: process.env.PUBLIC_ORIGIN ?? 'http://localhost:5173',
  webhookBaseUrl: process.env.WEBHOOK_BASE_URL ?? '',
  payments: {
    provider: (process.env.PAYMENTS_PROVIDER ?? 'none') as 'none' | 'mercadopago' | 'pagarme',
    mercadoPagoToken: process.env.MERCADO_PAGO_ACCESS_TOKEN ?? '',
    mercadoPagoWebhookSecret: process.env.MERCADO_PAGO_WEBHOOK_SECRET ?? '',
    pagarmeToken: process.env.PAGARME_API_KEY ?? '',
    pagarmeWebhookSecret: process.env.PAGARME_WEBHOOK_SECRET ?? '',
  },
  maps: {
    viacepUrl: 'https://viacep.com.br/ws',
    geocodingUrl: process.env.GEOCODING_URL ?? '', // ex: Nominatim / Google Geocoding
    geocodingKey: process.env.GEOCODING_API_KEY ?? '',
  },
  push: {
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? '',
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ?? '',
  },
  isProduction: process.env.NODE_ENV === 'production',
};
