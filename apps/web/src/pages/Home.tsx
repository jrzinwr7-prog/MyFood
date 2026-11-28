import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Star, Bike, Clock3, MapPin, SlidersHorizontal, Heart, ArrowRight, Store as StoreIcon, X } from 'lucide-react';
import { api, VISUAL_PREVIEW } from '../lib/api';
import { brl } from '../lib/format';
import { useApp } from '../state/AppContext';
import { Badge, Button, Card, EmptyState, SectionTitle, Spinner } from '../components/ui';
import { ConsumerShell } from '../components/Layout';

function StoreCard({ e, favorite }: { e: any; favorite?: boolean }) {
  return <Link to={`/loja/${e.slug}`} className="card-hover block overflow-hidden rounded-3xl border border-line/80 bg-white shadow-card">
    <div className="relative h-36 overflow-hidden bg-gradient-to-br from-ink to-navy">
      {e.coverUrl ? <img src={e.coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" /> :
        <img src={`${import.meta.env.BASE_URL}hero-burger.jpg`} alt="" className="h-full w-full object-cover opacity-90" loading="lazy" />}
      <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-transparent" />
      <div className="absolute left-3 top-3 flex gap-2">
        {!e.isOpen && <Badge tone="red">Fechado agora</Badge>}
        {e.distanceKm != null && <Badge tone="neutral">{e.distanceKm} km</Badge>}
      </div>
      {favorite && <span className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-coral"><Heart size={16} fill="currentColor" /></span>}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 text-white">
        <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-2xl border-2 border-white bg-white text-lg font-black text-coral">
          {e.logoUrl ? <img src={e.logoUrl} alt="" className="h-full w-full object-cover" /> : e.name.slice(0, 1)}
        </span>
      </div>
    </div>
    <div className="p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="line-clamp-1 text-sm font-extrabold">{e.name}</h3>
        <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-tangerine"><Star size={13} fill="currentColor" />{e.ratingAvg ? e.ratingAvg.toFixed(1) : 'Novo'}</span>
      </div>
      <p className="mt-1 line-clamp-1 text-xs text-ink/50">{e.categoryName} · {e.neighborhood}</p>
      <div className="mt-3 flex flex-wrap gap-3 text-[11px] font-bold text-ink/60">
        <span className="flex items-center gap-1"><Bike size={13} />{e.deliveryFeeCents === 0 ? 'Grátis' : brl(e.deliveryFeeCents)}</span>
        <span className="flex items-center gap-1"><Clock3 size={13} />{e.prepTimeMin}–{e.prepTimeMin + 15} min</span>
        <span className="flex items-center gap-1"><MapPin size={13} />{e.city}</span>
      </div>
    </div>
  </Link>;
}

export default function Home() {
  const { user } = useApp();
  const [params, setParams] = useSearchParams();
  const [categories, setCategories] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [address, setAddress] = useState<any>(null);
  const [sort, setSort] = useState('recommended');
  const [openOnly, setOpenOnly] = useState(false);
  const [category, setCategory] = useState('');
  const q = params.get('q') ?? '';
  const [search, setSearch] = useState(q);

  useEffect(() => { setSearch(q); }, [q]);
  useEffect(() => {
    let alive = true;
    Promise.all([
      api.get('/catalog/categories'), api.get('/catalog/banners'),
      user?.role === 'consumer' ? api.get('/orders/meta/favorites').catch(() => ({ items: [] })) : Promise.resolve({ items: [] }),
      user ? api.get('/addresses').catch(() => ({ items: [] })) : Promise.resolve({ items: [] }),
    ]).then(([c, b, f, a]) => {
      if (!alive) return;
      setCategories(c.items); setBanners(b.items); setFavorites(f.items);
      setAddress(a.items.find((x: any) => x.is_default) ?? a.items[0] ?? null);
    }).catch(() => {});
    return () => { alive = false; };
  }, [user?.id]);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams({ sort });
    if (q) qs.set('q', q); if (category) qs.set('category', category); if (openOnly) qs.set('open', 'true');
    if (VISUAL_PREVIEW) load(qs);
    else if (navigator.geolocation) navigator.geolocation.getCurrentPosition(p => { qs.set('lat', String(p.coords.latitude)); qs.set('lng', String(p.coords.longitude)); load(qs); }, () => load(qs), { timeout: 3000 });
    else load(qs);
    async function load(p: URLSearchParams) {
      try { const r = await api.get(`/catalog/establishments?${p}`); if (alive) setItems(r.items); }
      catch { if (alive) setItems([]); } finally { if (alive) setLoading(false); }
    }
    let alive = true;
    return () => { alive = false; };
  }, [q, category, sort, openOnly]);

  const topRated = useMemo(() => [...items].sort((a, b) => b.ratingAvg - a.ratingAvg).slice(0, 6), [items]);

  return <ConsumerShell>
    <section className="relative mb-9 overflow-hidden rounded-[2rem] bg-[#f7dfc7] shadow-card">
      <div className="absolute inset-0 sm:left-[38%]"><img src={`${import.meta.env.BASE_URL}hero-burger.jpg`} alt="" className="h-full w-full object-cover object-center" /></div>
      <div className="absolute inset-0 bg-gradient-to-r from-[#fff4e4] via-[#fff4e4]/95 to-[#fff4e4]/55 sm:via-[#fff4e4]/95 sm:to-transparent" />
      <div className="relative px-6 py-10 sm:px-10 sm:py-14 lg:px-14 lg:py-16">
        <p className="text-[11px] font-black uppercase tracking-[.2em] text-coral">Sua cidade tem sabor · FastDelivery</p>
        <h1 className="mt-4 max-w-lg text-4xl font-black leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-6xl">O melhor do seu dia <span className="text-coral">chega até você.</span></h1>
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink/75">Descubra os sabores da sua cidade, escolha seus favoritos e acompanhe seu pedido.</p>
        <form onSubmit={e => { e.preventDefault(); setParams(search ? { q: search } : {}); }} className="mt-7 flex max-w-lg gap-2">
          <div className="relative min-w-0 flex-1"><Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/50" />
            <input value={search} onChange={e => setSearch(e.target.value)} aria-label="Buscar restaurantes ou pratos" placeholder="O que você quer comer?" className="h-12 w-full rounded-2xl border border-white bg-white pl-11 pr-4 text-sm text-ink shadow-sm outline-none ring-coral focus:ring-4" /></div>
          <Button type="submit" className="h-12 shrink-0">Buscar</Button>
        </form>
        <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-ink/75"><MapPin size={15} className="text-coral" />
          {address ? <span>Entregando em <b>{address.label}, {address.street}, {address.number}</b></span> : <Link to="/perfil" className="font-bold underline underline-offset-2">Informe seu endereço de entrega</Link>}
        </div>
      </div>
    </section>

    {banners.length > 0 && <div className="no-scrollbar mb-7 flex gap-3 overflow-x-auto">
      {banners.map((b, i) => <div key={i} className="flex min-w-[280px] flex-1 items-center justify-between rounded-3xl bg-gradient-to-br from-[#a63118] to-[#b94c20] p-5 text-white shadow-card">
        <div><p className="text-sm font-black">{b.title}</p><p className="mt-1 text-xs text-white/80">{b.subtitle}</p></div><ArrowRight size={22} /></div>)}
    </div>}

    <section className="mb-8">
      <SectionTitle title="Explore por categoria" subtitle="Encontre exatamente o que você apetece" />
      <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
        <button onClick={() => setCategory('')} className={`flex min-w-[86px] flex-col items-center gap-2 rounded-2xl border p-3 text-[11px] font-bold transition ${!category ? 'border-coral bg-coral/10 text-coral' : 'border-line bg-white text-ink/60'}`}>
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-mist text-lg">✨</span>Todos
        </button>
        {categories.map(c => <button key={c.id} onClick={() => setCategory(category === c.id ? '' : c.id)}
          className={`flex min-w-[86px] flex-col items-center gap-2 rounded-2xl border p-3 text-center text-[11px] font-bold transition ${category === c.id ? 'border-coral bg-coral/10 text-coral' : 'border-line bg-white text-ink/60'}`}>
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-coral/15 to-tangerine/20 text-lg">
            {c.icon === 'pizza' ? '🍕' : c.icon === 'hamburger' ? '🍔' : c.icon === 'ice-cream' ? '🍦' : c.icon === 'cake' ? '🍰' : c.icon === 'coffee' ? '☕' : c.icon === 'sandwich' ? '🥪' : c.icon === 'soup' ? '🍲' : '🍽️'}
          </span>{c.name.replace('arias', 'aria').replace('erias', 'eria')}
        </button>)}
      </div>
    </section>

    {favorites.length > 0 && <section className="mb-8">
      <SectionTitle title="Seus favoritos" subtitle="Sempre pertinho de você" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{favorites.slice(0, 3).map(e => <StoreCard key={e.id} e={e} favorite />)}</div>
    </section>}

    <section>
      <SectionTitle title={q ? `Resultados para “${q}”` : 'Estabelecimentos perto de você'} subtitle={VISUAL_PREVIEW ? 'O catálogo estará disponível após conectar o servidor.' : `${items.length} estabelecimento${items.length === 1 ? '' : 's'} disponível${items.length === 1 ? '' : 'is'}`}
        action={<div className="flex items-center gap-2">
          <button onClick={() => setOpenOnly(!openOnly)} className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-bold ${openOnly ? 'border-mint bg-emerald-50 text-emerald-700' : 'border-line bg-white text-ink/60'}`}><StoreIcon size={14} />Abertos</button>
          <select value={sort} onChange={e => setSort(e.target.value)} className="rounded-xl border border-line bg-white px-3 py-2 text-[11px] font-bold outline-none">
            <option value="recommended">Recomendados</option><option value="distance">Mais próximos</option><option value="rating">Melhor avaliados</option><option value="fee">Menor taxa</option>
          </select>
        </div>} />
      {loading ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1,2,3,4,5,6].map(i => <div key={i} className="skeleton h-64 rounded-3xl" />)}</div>
        : items.length === 0 ? <EmptyState icon={<SlidersHorizontal />} title={VISUAL_PREVIEW ? 'Catálogo indisponível nesta prévia' : 'Nada por aqui ainda'} text={VISUAL_PREVIEW ? 'Os estabelecimentos aparecerão quando a API estiver conectada.' : 'Tente outra busca, categoria ou desative o filtro de estabelecimentos abertos.'}
          action={<Button variant="outline" onClick={() => { setParams({}); setCategory(''); setOpenOnly(false); setSearch(''); }}>Limpar filtros</Button>} />
        : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map(e => <StoreCard key={e.id} e={e} />)}</div>}
    </section>

    {!loading && topRated.length > 1 && <section className="mt-10">
      <SectionTitle title="Mais bem avaliados" subtitle="A escolha da vizinhança" />
      <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">{topRated.map(e => <Link key={e.id} to={`/loja/${e.slug}`} className="flex min-w-[230px] items-center gap-3 rounded-2xl border border-line bg-white p-3 shadow-card">
        <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-coral/10 text-lg font-black text-coral">{e.logoUrl ? <img src={e.logoUrl} className="h-full w-full object-cover" alt="" /> : e.name[0]}</span>
        <div className="min-w-0"><p className="truncate text-xs font-extrabold">{e.name}</p><p className="mt-1 text-[11px] text-ink/50">★ {e.ratingAvg.toFixed(1)} · {e.ratingCount} avaliações</p></div>
      </Link>)}</div>
    </section>}
  </ConsumerShell>;
}
