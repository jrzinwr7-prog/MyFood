import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { api, getToken, setToken, loadCart, saveCart, DEMO_MODE, type CartState } from '../lib/api';
import { demoUser } from '../../../../demo-temporaria/catalogo';
import { calculateCartTotals } from '@myfood/shared';

type Toast = { id: number; message: string; kind: 'success' | 'error' | 'info' };
interface Ctx {
  user: any | null; loadingAuth: boolean; login: (email: string, password: string) => Promise<any>;
  register: (body: any) => Promise<any>; logout: () => void; refreshUser: () => Promise<void>;
  cart: CartState | null; setCart: (c: CartState | null) => void; cartTotals: any;
  toasts: Toast[]; toast: (message: string, kind?: Toast['kind']) => void;
}
const Context = createContext<Ctx>(null as any);
export const useApp = () => useContext(Context);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(DEMO_MODE ? demoUser : null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [cart, setCartState] = useState<CartState | null>(loadCart());
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, kind: Toast['kind'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, message, kind }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4500);
  }, []);

  const refreshUser = useCallback(async () => {
    if (DEMO_MODE) { setUser(demoUser); setLoadingAuth(false); return; }
    if (!getToken()) { setUser(null); setLoadingAuth(false); return; }
    try { const r = await api.get('/auth/me'); setUser(r.user); }
    catch { setToken(null); setUser(null); }
    finally { setLoadingAuth(false); }
  }, []);
  useEffect(() => { refreshUser(); }, [refreshUser]);

  const setCart = useCallback((c: CartState | null) => { setCartState(c); saveCart(c); }, []);
  const cartTotals = useMemo(() => cart ? calculateCartTotals({ items: cart.items, deliveryFeeCents: cart.deliveryFeeCents }) : null, [cart]);

  const login = async (email: string, password: string) => {
    const r = await api.post('/auth/login', { email, password });
    setToken(r.token); setUser(r.user); toast(`Olá, ${r.user.name.split(' ')[0]}!`); return r;
  };
  const register = async (body: any) => {
    const r = await api.post('/auth/register', body);
    setToken(r.token); setUser(r.user); toast(r.message ?? 'Conta criada!'); return r;
  };
  const logout = () => { if (DEMO_MODE) { toast('A conta desta demonstração é fictícia.', 'info'); return; } setToken(null); setUser(null); setCart(null); toast('Sessão encerrada', 'info'); };

  return <Context.Provider value={{ user, loadingAuth, login, register, logout, refreshUser, cart, setCart, cartTotals, toasts, toast }}>
    {children}
    <div className="fixed bottom-24 right-4 z-[100] flex flex-col gap-2 md:bottom-6 md:right-6 max-w-[calc(100vw-2rem)]">
      {toasts.map(t => <div key={t.id} className={`rounded-2xl px-4 py-3 text-sm font-semibold shadow-float text-white animate-fadeUp ${t.kind === 'error' ? 'bg-red-600' : t.kind === 'info' ? 'bg-ink' : 'bg-mint'}`}>{t.message}</div>)}
    </div>
  </Context.Provider>;
}
