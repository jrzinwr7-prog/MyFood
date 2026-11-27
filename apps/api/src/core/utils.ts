import crypto from 'node:crypto';

export const now = () => new Date().toISOString();
export const uid = (prefix = '') => prefix + crypto.randomUUID().replaceAll('-', '');
export const json = (value: unknown) => JSON.stringify(value);
export const parseJson = <T>(value: unknown, fallback: T): T => {
  if (typeof value !== 'string' || !value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
};
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a), bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}
export function hmacSha256(secret: string, payload: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
export function onlyDigits(text: string): string { return text.replace(/\D/g, ''); }
export function maskEmail(email: string): string {
  const [u, d] = email.split('@'); return `${u.slice(0, 2)}***@${d ?? ''}`;
}
