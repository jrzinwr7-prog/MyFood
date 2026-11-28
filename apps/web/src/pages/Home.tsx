import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Star, Bike, Clock3, MapPin, SlidersHorizontal, Heart, ArrowRight, Store as StoreIcon, X } from 'lucide-react';
import { api, VISUAL_PREVIEW } from '../lib/api';
import { brl } from '../lib/format';
import { useApp } from '../state/AppContext';
import { Badge, Button, Card, EmptyState, SectionTitle, Spinner } from '../components/ui';
import { ConsumerShell } from '../components/Layout';

function StoreCard({ e, favorite }: { e: any; favorite?: boolean }) {
  return <Link to={`/loja/${e.slug}`} className="store-card card-hover">
    <div className="store-card__visual">
      {e.coverUrl ? <img src={e.coverUrl} alt="" loading="lazy" /> : <div className="store-card__placeholder"><StoreIcon size={34} strokeWidth={1.35} /></div>}
      <span className={`store-card__status ${e.isOpen ? 'is-open' : ''}`}><span aria-hidden="true" />{e.isOpen ? 'Aberto' : 'Fechado'}</span>
      {favorite && <span className="store-card__favorite" aria-label="Favorito"><Heart size={16} fill="currentColor" /></span>}
    </div>
    <div className="store-card__body">
      <div className="store-card__heading"><span className="store-card__logo">{e.logoUrl ? <img src={e.logoUrl} alt="" /> : e.name.slice(0, 1)}</span>
        <div className="min-w-0"><h3 className="truncate text-base font-extrabold">{e.name}</h3><p className="truncate text-xs text-ink/65">{e.categoryName} · {e.neighborhood}</p></div>
        <span className="store-card__rating"><Star size={13} fill="currentColor" />{e.ratingAvg ? e.ratingAvg.toFixed(1) : 'Novo'}</span>
      </div>
      <div className="store-card__meta"><span><Bike size={15} />{e.deliveryFeeCents === 0 ? 'Grátis' : brl(e.deliveryFeeCents)}</span><span><Clock3 size={15} />{e.prepTimeMin}–{e.prepTimeMin + 15} min</span>{e.distanceKm != null && <span><MapPin size={15} />{e.distanceKm} km</span>}</div>
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
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
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
    setLoading(true); setLoadError(false);
    const qs = new URLSearchParams({ sort });
    if (q) qs.set('q', q); if (category) qs.set('category', category); if (openOnly) qs.set('open', 'true');
    if (VISUAL_PREVIEW) load(qs);
    else if (navigator.geolocation) navigator.geolocation.getCurrentPosition(p => { qs.set('lat', String(p.coords.latitude)); qs.set('lng', String(p.coords.longitude)); load(qs); }, () => load(qs), { timeout: 3000 });
    else load(qs);
    async function load(p: URLSearchParams) {
      try { const r = await api.get(`/catalog/establishments?${p}`); if (alive) setItems(r.items); }
      catch { if (alive) { setItems([]); setLoadError(true); } } finally { if (alive) setLoading(false); }
    }
    let alive = true;
    return () => { alive = false; };
  }, [q, category, sort, openOnly, retry]);

  const topRated = useMemo(() => items.filter(e => e.ratingCount > 0).sort((a, b) => b.ratingAvg - a.ratingAvg).slice(0, 6), [items]);

  return <ConsumerShell>
    <section className="home-hero" aria-labelledby="home-heading">
      <div className="home-hero__content">
        <div className="home-hero__eyebrow"><span aria-hidden="true" /> DELIVERY LOCAL, DO SEU JEITO</div>
        <h1 id="home-heading">O melhor da cidade.<br /><em>Mais perto de você.</em></h1>
        <p>Encontre seus lugares favoritos, descubra novos sabores e acompanhe tudo em um só lugar.</p>
        <form onSubmit={e => { e.preventDefault(); setParams(search ? { q: search } : {}); }} className="home-search">
          <Search size={20} aria-hidden="true" /><input value={search} onChange={e => setSearch(e.target.value)} aria-label="Buscar restaurantes ou pratos" placeholder="O que você quer pedir?" />
          <button type="submit">Buscar <ArrowRight size={17} aria-hidden="true" /></button>
        </form>
        <div className="home-address"><span className="home-address__icon"><MapPin size={16} /></span><div><small>SEU ENDEREÇO</small>{address ? <span>{address.label}, {address.street}, {address.number}</span> : <Link to="/perfil">Adicione um endereço <ArrowRight size={14} /></Link>}</div></div>
      </div>
      <div className="home-hero__image"><img src={`${import.meta.env.BASE_URL}fastdelivery-hero.jpg`} alt="" /><div className="home-hero__image-label"><span>FASTDELIVERY</span><b>Seu pedido,<br />seu momento.</b></div></div>
    </section>

    {banners.length > 0 && <div className="no-scrollbar mb-7 flex gap-3 overflow-x-auto">
      {banners.map((b, i) => <div key={i} className="home-promo min-w-[280px] flex-1">
        <div><p className="text-sm font-black">{b.title}</p><p className="mt-1 text-xs text-white/80">{b.subtitle}</p></div></div>)}
    </div>}

    <section className="home-section mb-10">
      <SectionTitle title="Explore por categoria" subtitle="Escolha uma categoria e descubra opções" />
      <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
        <button aria-pressed={!category} onClick={() => setCategory('')} className={`category-tile ${!category ? 'is-selected' : ''}`}>
          <span className="category-tile__icon">✨</span>Todos
        </button>
        {categories.map(c => <button key={c.id} aria-pressed={category === c.id} onClick={() => setCategory(category === c.id ? '' : c.id)}
          className={`category-tile ${category === c.id ? 'is-selected' : ''}`}>
          <span className="category-tile__icon">
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
      <SectionTitle title={q ? `Resultados para “${q}”` : 'Explore estabelecimentos'} subtitle={VISUAL_PREVIEW ? 'O catálogo estará disponível após conectar o servidor.' : loadError ? 'Não foi possível carregar o catálogo.' : `${items.length} estabelecimento${items.length === 1 ? '' : 's'} disponível${items.length === 1 ? '' : 'is'}`}
        action={<div className="flex items-center gap-2">
          <button aria-pressed={openOnly} onClick={() => setOpenOnly(!openOnly)} className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-bold ${openOnly ? 'border-mint bg-emerald-50 text-emerald-700' : 'border-line bg-white text-ink/60'}`}><StoreIcon size={14} />Abertos</button>
          <select aria-label="Ordenar estabelecimentos" value={sort} onChange={e => setSort(e.target.value)} className="rounded-xl border border-line bg-white px-3 py-2 text-[11px] font-bold outline-none">
            <option value="recommended">Recomendados</option><option value="distance">Mais próximos</option><option value="rating">Melhor avaliados</option><option value="fee">Menor taxa</option>
          </select>
        </div>} />
      {loading ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1,2,3,4,5,6].map(i => <div key={i} className="skeleton h-64 rounded-3xl" />)}</div>
        : loadError ? <EmptyState title="Não foi possível carregar as lojas" text="Verifique sua conexão e tente novamente. O servidor de teste pode levar alguns instantes para responder." action={<Button variant="outline" onClick={() => setRetry(v => v + 1)}>Tentar novamente</Button>} />
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
