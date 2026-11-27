import type { CartItem } from '@myfood/shared';

export const API_ORIGIN = (import.meta.env.VITE_API_ORIGIN || '').replace(/\/$/, '');
export const VISUAL_PREVIEW = import.meta.env.VITE_VISUAL_PREVIEW === 'true';
export const TOKEN_KEY = 'myfood_token';
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string | null) => token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY);

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string, public details?: any[]) { super(message); }
}

export async function request<T = any>(path: string, opts: { method?: string; body?: any; token?: boolean } = {}): Promise<T> {
  if (VISUAL_PREVIEW) throw new ApiError(503, 'Esta é uma prévia visual. O servidor ainda não está conectado.');
  const token = opts.token === false ? null : getToken();
  const res = await fetch(`${API_ORIGIN}/api${path}`, {
    method: opts.method ?? 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Erro na requisição', data.code, data.details);
  return data as T;
}
export const api = {
  get: <T = any>(p: string) => request<T>(p),
  post: <T = any>(p: string, body?: any) => request<T>(p, { method: 'POST', body }),
  patch: <T = any>(p: string, body?: any) => request<T>(p, { method: 'PATCH', body }),
  del: <T = any>(p: string) => request<T>(p, { method: 'DELETE' }),
};

export type CartState = { establishmentId: string; establishmentName: string; deliveryFeeCents: number; items: CartItem[] };
const CART_KEY = 'myfood_cart';
export function loadCart(): CartState | null {
  try { const raw = localStorage.getItem(CART_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export function saveCart(cart: CartState | null) {
  if (cart) localStorage.setItem(CART_KEY, JSON.stringify(cart)); else localStorage.removeItem(CART_KEY);
}
export function socketUrl(token: string) {
  const origin = new URL(API_ORIGIN || location.origin);
  origin.protocol = origin.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${origin.origin}/ws?token=${encodeURIComponent(token)}`;
}
