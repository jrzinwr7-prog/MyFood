import AsyncStorage from '@react-native-async-storage/async-storage';

/** URL do backend. Em dispositivo físico, use o IP da máquina na rede local. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.1.10:4000').replace(/\/$/, '');
const TOKEN_KEY = 'myfood_token';

export async function getToken() { return AsyncStorage.getItem(TOKEN_KEY); }
export async function setToken(t: string | null) { return t ? AsyncStorage.setItem(TOKEN_KEY, t) : AsyncStorage.removeItem(TOKEN_KEY); }

export async function request<T = any>(path: string, opts: { method?: string; body?: any } = {}): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_URL}/api${path}`, {
    method: opts.method ?? 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`);
  return data as T;
}
export const api = {
  get: <T = any>(p: string) => request<T>(p),
  post: <T = any>(p: string, b?: any) => request<T>(p, { method: 'POST', body: b }),
  patch: <T = any>(p: string, b?: any) => request<T>(p, { method: 'PATCH', body: b }),
};
export const brl = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents ?? 0) / 100);
export const shortDate = (v: string) => v ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(v)) : '—';
