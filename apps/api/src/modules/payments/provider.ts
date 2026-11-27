import { config } from '../../core/config.js';
import { bad, conflict } from '../../core/errors.js';
import type { PaymentMethod } from '@myfood/shared';

export interface PaymentInit {
  id: string; orderId: string; amountCents: number; method: PaymentMethod;
  description: string; idempotencyKey: string; payerEmail: string; notificationUrl?: string; raw?: Record<string, unknown>;
}
export interface PaymentInitResult {
  providerId: string | null; status: 'pending' | 'approved' | 'rejected';
  instructions?: string; qrCode?: string; checkoutUrl?: string; raw: unknown;
}

export interface PaymentProvider {
  name: 'none' | 'mercadopago' | 'pagarme';
  initialize(input: PaymentInit): Promise<PaymentInitResult>;
  verifyWebhook(req: { headers: Record<string, any>; rawBody: string }): boolean;
  normalizeEvent(payload: any): { eventId: string; paymentId: string | null; status: 'approved' | 'rejected' | 'refunded' | 'pending' };
  refund(providerId: string, amountCents: number): Promise<string>;
}

/** Modalidade sem provedor: NUNCA aprova automaticamente. Pagamento fica pendente
 *  até confirmação explícita do estabelecimento/administrador (dinheiro/PIX manual). */
const manualProvider: PaymentProvider = {
  name: 'none',
  async initialize(input) {
    if (!['cash', 'pix_manual'].includes(input.method))
      throw bad(`Pagamento por ${input.method} exige um provedor configurado. Configure PAYMENTS_PROVIDER.`, 'payment_provider_not_configured');
    return {
      providerId: null, status: 'pending',
      instructions: input.method === 'cash'
        ? 'Pagamento em dinheiro na entrega. Aguarde a confirmação do estabelecimento.'
        : 'PIX manual: chave e instruções serão fornecidas pelo estabelecimento. O pedido só será confirmado após pagamento verificado.',
      raw: { mode: 'manual', method: input.method },
    };
  },
  verifyWebhook() { return false; },
  normalizeEvent() { throw bad('Webhooks não suportados sem provedor configurado'); },
  async refund() { throw bad('Reembolso manual deve ser registrado pelo administrador'); },
};

function mpSignatureValid(secret: string, headers: any, rawBody: string): boolean {
  // Mercado Pago: x-signature = "ts=<epoch>,v1=<hmac>"; manifest = id:[id];request-id:[request-id];ts:[ts]
  const header = String(headers['x-signature'] ?? '');
  const ts = header.match(/ts=(\d+)/)?.[1];
  const v1 = header.match(/v1=([a-f0-9]+)/i)?.[1];
  const dataId = String(headers['x-request-id'] ?? '');
  if (!ts || !v1 || !secret) return false;
  const url = new URLSearchParams(rawBody);
  const resourceId = url.get('data.id') ?? (() => { try { return String(JSON.parse(rawBody)?.data?.id ?? ''); } catch { return ''; } })();
  const manifest = `id:${resourceId};request-id:${dataId};ts:${ts};`;
  const { createHmac, timingSafeEqual } = requireCrypto();
  const calc = createHmac('sha256', secret).update(manifest).digest('hex');
  const a = Buffer.from(calc), b = Buffer.from(v1);
  return a.length === b.length && timingSafeEqual(a, b);
}

function requireCrypto() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return (globalThis.process?.getBuiltinModule?.('node:crypto') ?? {}) as typeof import('node:crypto');
}

const mercadoPagoProvider: PaymentProvider = {
  name: 'mercadopago',
  async initialize(input) {
    if (!config.payments.mercadoPagoToken) throw bad('MERCADO_PAGO_ACCESS_TOKEN não configurado', 'payment_provider_not_configured');
    const isPix = input.method === 'pix' || input.method === 'pix_manual';
    const body: any = isPix
      ? { transaction_amount: input.amountCents / 100, description: input.description,
          payment_method_id: 'pix', payer: { email: input.payerEmail },
          notification_url: input.notificationUrl || undefined }
      : { items: [{ id: input.orderId, title: input.description, quantity: 1, unit_price: input.amountCents / 100 }],
          payer: { email: input.payerEmail }, notification_url: input.notificationUrl || undefined,
          back_urls: { success: `${config.publicOrigin}/pedidos`, failure: `${config.publicOrigin}/pedidos`, pending: `${config.publicOrigin}/pedidos` },
          auto_return: 'approved' };
    const response = await fetch('https://api.mercadopago.com/v1/' + (isPix ? 'payments' : 'preferences'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.payments.mercadoPagoToken}`, 'Content-Type': 'application/json',
        'X-Idempotency-Key': input.idempotencyKey },
      body: JSON.stringify(body),
    });
    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) throw conflict(`Pagamento recusado pelo provedor: ${data.message ?? response.status}`, 'provider_error');
    return isPix
      ? { providerId: String(data.id), status: data.status === 'approved' ? 'approved' : 'pending',
          qrCode: data.point_of_interaction?.transaction_data?.qr_code,
          checkoutUrl: data.point_of_interaction?.transaction_data?.ticket_url, raw: data }
      : { providerId: String(data.id), status: 'pending', checkoutUrl: data.init_point, raw: data };
  },
  verifyWebhook(req) { return mpSignatureValid(config.payments.mercadoPagoWebhookSecret, req.headers, req.rawBody); },
  normalizeEvent(payload) {
    const id = String(payload?.data?.id ?? payload?.id ?? '');
    const type = String(payload?.type ?? payload?.action ?? '');
    const status = payload?.status ?? (type.includes('payment') ? type : '');
    return { eventId: String(payload?.id ?? payload?.data?.id ?? id), paymentId: id,
      status: status === 'approved' ? 'approved' : status === 'rejected' || status === 'cancelled' ? 'rejected'
        : status === 'refunded' ? 'refunded' : 'pending' };
  },
  async refund(providerId, amountCents) {
    const response = await fetch('https://api.mercadopago.com/v1/payments/' + providerId + '/refunds', {
      method: 'POST', headers: { Authorization: `Bearer ${config.payments.mercadoPagoToken}`, 'Content-Type': 'application/json',
        'X-Idempotency-Key': `refund-${providerId}-${amountCents}` },
      body: JSON.stringify({ amount: amountCents / 100 }),
    });
    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) throw conflict(`Estorno recusado: ${data.message ?? response.status}`, 'refund_error');
    return String(data.id);
  },
};

const pagarmeProvider: PaymentProvider = {
  name: 'pagarme',
  async initialize(input) {
    if (!config.payments.pagarmeToken) throw bad('PAGARME_API_KEY não configurado', 'payment_provider_not_configured');
    const isPix = input.method === 'pix' || input.method === 'pix_manual';
    const body: any = {
      amount: input.amountCents, customer: { email: input.payerEmail },
      payment_method: isPix ? 'pix' : input.method === 'debit_card' ? 'debit_card' : 'credit_card',
      ...(isPix ? {} : { card_token: input.raw?.cardToken }),
      // split rules aplicadas quando a conta marketplace estiver configurada:
      split_rules: [], metadata: { order_id: input.orderId, myfood_idempotency: input.idempotencyKey },
    };
    const response = await fetch('https://api.pagar.me/core/v5/orders', {
      method: 'POST', headers: { Authorization: `Basic ${Buffer.from(config.payments.pagarmeToken + ':').toString('base64')}`,
        'Content-Type': 'application/json', 'X-Idempotency-Key': input.idempotencyKey },
      body: JSON.stringify(body),
    });
    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) throw conflict(`Pagamento recusado pelo provedor: ${data.message ?? response.status}`, 'provider_error');
    return { providerId: String(data.id), status: data.status === 'paid' ? 'approved' : 'pending',
      qrCode: data.pix?.qrcode, checkoutUrl: data.checkout_url, raw: data };
  },
  verifyWebhook(req) {
    const secret = config.payments.pagarmeWebhookSecret;
    if (!secret) return false;
    const signature = String(req.headers['x-hub-signature'] ?? '');
    const { createHmac, timingSafeEqual } = requireCrypto();
    const calc = createHmac('sha256', secret).update(req.rawBody).digest('hex');
    const a = Buffer.from(calc), b = Buffer.from(signature.replace(/^sha256=/, ''));
    return a.length === b.length && timingSafeEqual(a, b);
  },
  normalizeEvent(payload) {
    const status = String(payload?.status ?? '');
    return { eventId: String(payload?.id ?? ''), paymentId: String(payload?.order?.id ?? payload?.id ?? ''),
      status: status === 'paid' ? 'approved' : status === 'refunded' ? 'refunded' : status === 'failed' ? 'rejected' : 'pending' };
  },
  async refund(providerId, amountCents) {
    const response = await fetch(`https://api.pagar.me/core/v5/orders/${providerId}/refunds`, {
      method: 'POST', headers: { Authorization: `Basic ${Buffer.from(config.payments.pagarmeToken + ':').toString('base64')}`,
        'Content-Type': 'application/json', 'X-Idempotency-Key': `refund-${providerId}-${amountCents}` },
      body: JSON.stringify({ amount: amountCents }),
    });
    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) throw conflict(`Estorno recusado: ${data.message ?? response.status}`, 'refund_error');
    return String(data.id);
  },
};

export function activeProvider(): PaymentProvider {
  if (config.payments.provider === 'mercadopago') return mercadoPagoProvider;
  if (config.payments.provider === 'pagarme') return pagarmeProvider;
  return manualProvider;
}
