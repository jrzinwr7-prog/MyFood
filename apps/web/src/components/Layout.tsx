import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Home, ShoppingBag, MessageCircle, User, LayoutDashboard, Store, Bike, ShieldCheck, LogOut, Search, MapPin, ChevronRight, Menu, X } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { getToken } from '../lib/api';

function Logo({ compact }: { compact?: boolean }) {
  return <Link to="/" className="flex items-center gap-2.5 shrink-0">
    <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-coral to-tangerine text-lg font-black text-white shadow-lg shadow-coral/25">F</span>
    {!compact && <span className="text-xl font-extrabold tracking-tight">Fast<span className="text-coral">Delivery</span></span>}
  </Link>;
}

export function ConsumerShell({ children }: { children: React.ReactNode }) {
  const { user, logout, cart, cartTotals } = useApp();
  const [q, setQ] = useState(''); const navigate = useNavigate(); const loc = useLocation();
  const count = cart?.items.reduce((s, i) => s + i.quantity, 0) ?? 0;
  return <div className="min-h-screen bg-mist">
    <header className="sticky top-0 z-30 border-b border-line/70 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Logo />
        <div className="hidden flex-1 items-center md:flex">
          <form onSubmit={e => { e.preventDefault(); navigate(`/?q=${encodeURIComponent(q)}`); }} className="relative w-full max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/35" size={18} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Busque restaurantes ou pratos" className="h-11 w-full rounded-2xl border border-line bg-mist pl-11 pr-4 text-sm outline-none focus:border-coral" />
          </form>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {user?.role === 'merchant' && <Link to="/merchant" className="hidden rounded-xl px-3 py-2 text-xs font-bold text-ink/60 hover:bg-mist sm:block">Portal da loja</Link>}
          {user?.role === 'courier' && <Link to="/courier" className="hidden rounded-xl px-3 py-2 text-xs font-bold text-ink/60 hover:bg-mist sm:block">Área do entregador</Link>}
          {user?.role === 'admin' && <Link to="/admin" className="hidden rounded-xl px-3 py-2 text-xs font-bold text-ink/60 hover:bg-mist sm:block">Administração</Link>}
          <Link to="/carrinho" className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-mist hover:bg-line">
            <ShoppingBag size={19} />
            {count > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-coral px-1 text-[10px] font-black text-white">{count}</span>}
          </Link>
          <Link to={user ? '/perfil' : '/entrar'} className="flex h-10 items-center gap-2 rounded-2xl bg-ink px-3 text-xs font-bold text-white sm:px-4">
            <User size={16} /><span className="hidden sm:inline">{user ? user.name.split(' ')[0] : 'Entrar'}</span>
          </Link>
        </div>
      </div>
    </header>
    <main className="mx-auto min-h-[70vh] max-w-6xl px-4 pb-28 pt-5 sm:px-6 md:pb-16">{children}</main>
    {loc.pathname !== '/suporte-ia' && <Link to="/suporte-ia" aria-label="Abrir suporte por inteligência artificial" className="fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full bg-ink px-4 py-3 text-xs font-extrabold text-white shadow-float transition hover:bg-coral md:bottom-6"><MessageCircle size={18} /> Suporte IA</Link>}
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
        {[
          { to: '/', icon: Home, label: 'Início' }, { to: '/pedidos', icon: ShoppingBag, label: 'Pedidos' },
          { to: '/conversas', icon: MessageCircle, label: 'Conversas' }, { to: '/perfil', icon: User, label: 'Perfil' },
        ].map(i => <NavLink key={i.to} to={i.to} end={i.to === '/'} className={({ isActive }) => `flex flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 text-[10px] font-bold ${isActive ? 'text-coral' : 'text-ink/45'}`}>
          <i.icon size={21} />{i.label}</NavLink>)}
      </div>
    </nav>
    <footer className="hidden border-t border-line bg-white py-8 md:block">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5 px-6 text-xs text-ink/50">
        <div><Logo /> <p className="mt-2">Delivery local conectando você ao melhor da sua cidade.</p></div>
        <div className="flex gap-6"><Link to="/termos">Termos de uso</Link><Link to="/privacidade">Privacidade (LGPD)</Link><Link to="/ajuda">Ajuda</Link><Link to="/suporte-ia">Suporte IA</Link></div>
        <p>© {new Date().getFullYear()} FastDelivery</p>
      </div>
    </footer>
  </div>;
}

const dashboards = {
  merchant: { icon: Store, label: 'Portal da loja', links: [ ['/merchant', 'Visão geral', LayoutDashboard], ['/merchant/pedidos', 'Pedidos', ShoppingBag], ['/merchant/cardapio', 'Cardápio', Store], ['/merchant/financeiro', 'Financeiro', LayoutDashboard], ['/merchant/configuracoes', 'Configurações', User] ] as const },
  courier: { icon: Bike, label: 'Área do entregador', links: [ ['/courier', 'Painel', LayoutDashboard], ['/courier/solicitacoes', 'Solicitações', MapPin], ['/courier/entregas', 'Minhas entregas', ShoppingBag], ['/courier/ganhos', 'Ganhos', LayoutDashboard] ] as const },
  admin: { icon: ShieldCheck, label: 'Administração', links: [ ['/admin', 'Dashboard', LayoutDashboard], ['/admin/estabelecimentos', 'Estabelecimentos', Store], ['/admin/entregadores', 'Entregadores', Bike], ['/admin/usuarios', 'Consumidores', User], ['/admin/pedidos', 'Pedidos', ShoppingBag], ['/admin/financeiro', 'Financeiro', LayoutDashboard], ['/admin/configuracoes', 'Configurações', User], ['/admin/suporte', 'Suporte', MessageCircle] ] as const },
};

export function DashShell({ role, children, title }: { role: keyof typeof dashboards; children: React.ReactNode; title: string }) {
  const { user, logout } = useApp(); const navigate = useNavigate(); const cfg = dashboards[role];
  const [menu, setMenu] = useState(false);
  if (!getToken()) { navigate('/entrar'); return null; }
  if (user && user.role !== role) return <ConsumerShell><div className="card p-8 text-center"><h2 className="text-xl font-extrabold">Acesso restrito</h2><p className="mt-2 text-sm text-ink/60">Este painel é exclusivo do perfil {role}.</p></div></ConsumerShell>;
  return <div className="min-h-screen bg-mist lg:flex">
    <aside className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-line bg-white p-5 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${menu ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center justify-between"><Logo /><button onClick={() => setMenu(false)} className="lg:hidden"><X size={20} /></button></div>
      <p className="mt-6 text-[10px] font-black uppercase tracking-widest text-ink/35">{cfg.label}</p>
      <nav className="mt-3 space-y-1">
        {cfg.links.map(([to, label, Icon]) => <NavLink key={to} to={to} end onClick={() => setMenu(false)}
          className={({ isActive }) => `flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold transition ${isActive ? 'bg-coral/10 text-coral' : 'text-ink/60 hover:bg-mist'}`}>
          <Icon size={18} />{label}</NavLink>)}
      </nav>
      <div className="absolute bottom-5 left-5 right-5">
        <Link to="/" className="mb-2 flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-bold text-ink/55 hover:bg-mist"><ChevronRight size={15} />Ver aplicativo</Link>
        <button onClick={() => { logout(); navigate('/'); }} className="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-50"><LogOut size={15} />Sair</button>
      </div>
    </aside>
    {menu && <div className="fixed inset-0 z-30 bg-ink/40 lg:hidden" onClick={() => setMenu(false)} />}
    <div className="min-w-0 flex-1">
      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-white/90 px-4 backdrop-blur-xl sm:px-6">
        <button onClick={() => setMenu(true)} className="rounded-xl bg-mist p-2 lg:hidden"><Menu size={20} /></button>
        <h1 className="truncate text-lg font-extrabold">{title}</h1>
        <span className="ml-auto hidden text-xs font-semibold text-ink/50 sm:block">{user?.name}</span>
        <div className="grid h-9 w-9 place-items-center rounded-full bg-ink text-xs font-bold text-white">{user?.name?.slice(0, 2).toUpperCase()}</div>
      </header>
      <main className="mx-auto max-w-6xl p-4 sm:p-6">{children}</main>
    </div>
  </div>;
}
