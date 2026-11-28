import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Bike, Clock3, Heart, Info, MapPin, Minus, Plus, ShoppingBag, Star, X, UtensilsCrossed, Store } from 'lucide-react';
import { api } from '../lib/api';
import { brl, phone } from '../lib/format';
import { useApp } from '../state/AppContext';
import { ConsumerShell } from '../components/Layout';
import { Badge, Button, Card, Modal, Spinner, Textarea } from '../components/ui';
import type { CartItem } from '@myfood/shared';

function days(hours: any) {
  const names: Record<string, string> = { mon: 'Seg', tue: 'Ter', wed: 'Qua', thu: 'Qui', fri: 'Sex', sat: 'Sáb', sun: 'Dom' };
  return Object.entries(names).map(([k, label]) => <div key={k} className="flex justify-between py-1.5 text-xs">
    <span className="text-ink/60">{label}</span><span className="font-bold">{hours?.[k]?.closed ? 'Fechado' : hours?.[k] ? `${hours[k].open} – ${hours[k].close}` : 'Não informado'}</span></div>);
}

export default function StorePage() {
  const { slug } = useParams();
  const { cart, setCart, toast, user } = useApp();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<any>(null);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');
  const [hoursOpen, setHoursOpen] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [tab, setTab] = useState('');

  useEffect(() => {
    let alive = true; setLoading(true);
    api.get(`/catalog/establishments/${slug}`).then(r => { if (alive) { setData(r); setTab(Object.keys(groupProducts(r.products))[0] ?? ''); } })
      .catch(() => { if (alive) setData(null); }).finally(() => { if (alive) setLoading(false); });
    if (user?.role === 'consumer') api.get('/orders/meta/favorites').then(r => setFavorite(r.items.some((e: any) => e.slug === slug))).catch(() => {});
    return () => { alive = false; };
  }, [slug, user?.id]);

  function groupProducts(products: any[]) {
    const groups: Record<string, any[]> = {};
    products.forEach(p => { const k = p.categoryName || 'Cardápio'; (groups[k] ??= []).push(p); });
    return groups;
  }
  const grouped = useMemo(() => data ? groupProducts(data.products) : {}, [data]);
  const est = data?.establishment;

  function openProduct(p: any) { setProduct(p); setSelected({}); setQty(1); setNotes(''); }
  function toggleOption(groupId: string, optionId: string, max: number) {
    setSelected(prev => {
      const cur = prev[groupId] ?? [];
      if (cur.includes(optionId)) return { ...prev, [groupId]: cur.filter(x => x !== optionId) };
      if (max === 1) return { ...prev, [groupId]: [optionId] };
      if (cur.length >= max) return prev;
      return { ...prev, [groupId]: [...cur, optionId] };
    });
  }
  function addToCart() {
    if (!product || !est) return;
    const options: CartItem['options'] = [];
    for (const g of product.groups ?? []) {
      for (const id of selected[g.id] ?? []) {
        const o = g.options.find((x: any) => x.id === id);
        if (o) options.push({ group_name: g.name, option_name: o.name, price_cents: o.priceCents, option_id: o.id });
      }
      if ((selected[g.id]?.length ?? 0) < g.minSelected) { toast(`Selecione ao menos ${g.minSelected} opção de ${g.name}`, 'error'); return; }
    }
    const unit = product.priceCents;
    const item: CartItem = { key: `${product.id}|${options.map(o => o.option_name).sort().join(',')}|${notes}`,
      product_id: product.id, name: product.name, unit_price_cents: unit, quantity: qty, options,
      notes: notes || null, image_url: product.imageUrl };
    if (cart && cart.establishmentId !== est.id) {
      if (!confirm('Seu carrinho possui itens de outro estabelecimento. Deseja iniciar um novo carrinho?')) return;
    }
    const base = cart && cart.establishmentId === est.id ? cart : { establishmentId: est.id, establishmentName: est.name, establishmentSlug: est.slug, deliveryFeeCents: est.deliveryFeeCents, items: [] as CartItem[] };
    const existing = base.items.find(i => i.key === item.key);
    const items = existing ? base.items.map(i => i.key === item.key ? { ...i, quantity: i.quantity + qty } : i) : [...base.items, item];
    setCart({ ...base, items }); setProduct(null); toast('Item adicionado ao carrinho!');
  }

  async function toggleFavorite() {
    if (!user) { toast('Entre para salvar favoritos', 'info'); return; }
    try { const r = await api.post(`/orders/favorites/${est.id}`, {}); setFavorite(r.favorite); toast(r.favorite ? 'Adicionado aos favoritos' : 'Removido dos favoritos', 'info'); }
    catch (e: any) { toast(e.message, 'error'); }
  }

  if (loading) return <ConsumerShell><Spinner label="Carregando estabelecimento…" /></ConsumerShell>;
  if (!data || !est) return <ConsumerShell><div className="rounded-3xl bg-white p-10 text-center"><h2 className="text-xl font-extrabold">Estabelecimento indisponível</h2>
    <Link to="/" className="mt-4 inline-block text-sm font-bold text-coral underline">Voltar ao início</Link></div></ConsumerShell>;

  return <ConsumerShell>
    <Link to="/" className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold text-ink/50 hover:text-coral"><ArrowLeft size={15} />Voltar</Link>
    <div className="relative mb-5 h-44 overflow-hidden rounded-3xl bg-ink sm:h-56">
      {est.coverUrl ? <img src={est.coverUrl} className="h-full w-full object-cover" alt="" /> : <div className="grid h-full place-items-center bg-[#f0e1d5] text-[#ab8069]"><Store size={45} strokeWidth={1.2} /></div>}
      <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" />
      <button onClick={toggleFavorite} aria-label={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"} aria-pressed={favorite} className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-coral"><Heart size={18} fill={favorite ? 'currentColor' : 'none'} /></button>
    </div>
    <div className="-mt-12 mb-6 relative px-1">
      <div className="grid h-20 w-20 place-items-center rounded-3xl border-4 border-white bg-white text-3xl font-black text-coral shadow-float">
        {est.logoUrl ? <img src={est.logoUrl} className="h-full w-full rounded-2xl object-cover" alt="" /> : est.name[0]}
      </div>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{est.name}</h1>
          <p className="mt-1 text-xs text-ink/55">{est.categoryName} · {est.neighborhood}, {est.city} · {phone(est.phone)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={est.isOpen ? 'green' : 'red'}>{est.isOpen ? 'Aberto agora' : 'Fechado'}</Badge>
          <Badge tone="neutral"><Star size={11} fill="currentColor" className="mr-1 inline text-tangerine" />{est.ratingAvg ? est.ratingAvg.toFixed(1) : 'Novo'} ({est.ratingCount})</Badge>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold">
        <span className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 shadow-card"><Bike size={14} className="text-coral" />{est.deliveryFeeCents ? brl(est.deliveryFeeCents) : 'Entrega grátis'}</span>
        <span className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 shadow-card"><Clock3 size={14} className="text-coral" />{est.prepTimeMin}–{est.prepTimeMin + 15} min</span>
        <button onClick={() => setHoursOpen(true)} className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 shadow-card hover:text-coral"><Info size={14} />Horários</button>
        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${est.street}, ${est.number}, ${est.city}`)}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 shadow-card hover:text-coral"><MapPin size={14} />Ver no mapa</a>
      </div>
      {est.description && <p className="mt-3 max-w-2xl text-sm text-ink/60">{est.description}</p>}
    </div>

    <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto border-b border-line pb-2">
      {Object.keys(grouped).map(k => <button key={k} onClick={() => setTab(k)} className={`whitespace-nowrap rounded-xl px-4 py-2 text-xs font-extrabold transition ${tab === k ? 'bg-ink text-white' : 'bg-white text-ink/55'}`}>
        {k}
      </button>)}
    </div>

    {(grouped[tab] ?? []).length === 0 ? <div className="rounded-3xl border border-dashed border-line bg-white p-10 text-center text-sm text-ink/50">Nenhum produto nesta categoria.</div> :
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(grouped[tab] ?? []).map(p => <button key={p.id} onClick={() => openProduct(p)} className="card-hover flex gap-3 rounded-3xl border border-line/80 bg-white p-3 text-left shadow-card">
          <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl bg-cream text-3xl">
            {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" loading="lazy" /> : <UtensilsCrossed size={25} className="text-[#ad8571]" />}
          </div>
          <div className="min-w-0 flex-1 py-1">
            <p className="line-clamp-2 text-sm font-extrabold leading-snug">{p.name}</p>
            <p className="mt-1 line-clamp-2 text-[11px] text-ink/50">{p.description}</p>
            <p className="mt-2 text-sm font-black text-coral">{brl(p.priceCents)}</p>
          </div>
        </button>)}
      </div>}

    {cart && cart.establishmentId === est.id && cart.items.length > 0 && <div className="fixed bottom-20 left-1/2 z-20 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 md:bottom-6">
      <Link to="/carrinho" className="flex items-center justify-between rounded-2xl bg-ink px-5 py-4 text-white shadow-float">
        <span className="flex items-center gap-2 text-sm font-bold"><ShoppingBag size={18} />Ver carrinho ({cart.items.reduce((s, i) => s + i.quantity, 0)})</span>
        <span className="text-sm font-black">{brl((cart?.items ?? []).reduce((s, i) => s + (i.unit_price_cents + i.options.reduce((a, o) => a + o.price_cents, 0)) * i.quantity, 0))}</span>
      </Link>
    </div>}

    <Modal open={!!product} onClose={() => setProduct(null)} title={product?.name ?? ''} wide>
      {product && <div>
        <div className="mb-4 h-44 overflow-hidden rounded-2xl bg-cream">{product.imageUrl ? <img src={product.imageUrl} className="h-full w-full object-cover" alt="" /> : <div className="grid h-full place-items-center text-[#ad8571]"><UtensilsCrossed size={40} strokeWidth={1.4} /></div>}</div>
        <p className="mb-4 text-sm text-ink/60">{product.description}</p>
        {(product.groups ?? []).map((g: any) => <div key={g.id} className="mb-5 rounded-2xl border border-line p-4">
          <div className="mb-3 flex items-center justify-between"><h4 className="text-sm font-extrabold">{g.name}</h4>
            <Badge tone={g.minSelected ? 'orange' : 'neutral'}>{g.minSelected ? `Mín. ${g.minSelected}` : 'Opcional'} · máx. {g.maxSelected}</Badge></div>
          <div className="space-y-2">{g.options.map((o: any) => {
            const on = (selected[g.id] ?? []).includes(o.id);
            return <button key={o.id} onClick={() => toggleOption(g.id, o.id, g.maxSelected)} className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-xs font-bold transition ${on ? 'border-coral bg-coral/5 text-coral' : 'border-line bg-white'}`}>
              <span>{o.name}</span><span>{o.priceCents ? `+ ${brl(o.priceCents)}` : 'Incluído'}</span></button>;
          })}</div>
        </div>)}
        <Textarea label="Observações (ex.: remover cebola)" value={notes} onChange={e => setNotes(e.target.value)} rows={2} maxLength={300} />
        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 rounded-2xl bg-mist p-1">
            <button aria-label="Diminuir quantidade" onClick={() => setQty(Math.max(1, qty - 1))} className="grid h-9 w-9 place-items-center rounded-xl bg-white"><Minus size={15} /></button>
            <span className="w-6 text-center text-sm font-black">{qty}</span>
            <button aria-label="Aumentar quantidade" onClick={() => setQty(Math.min(30, qty + 1))} className="grid h-9 w-9 place-items-center rounded-xl bg-white"><Plus size={15} /></button>
          </div>
          <Button onClick={addToCart} className="flex-1">Adicionar · {brl((product.priceCents + product.groups.reduce((s: number, g: any) => s + (selected[g.id] ?? []).reduce((a: number, id: string) => a + (g.options.find((o: any) => o.id === id)?.priceCents ?? 0), 0), 0)) * qty)}</Button>
        </div>
      </div>}
    </Modal>
    <Modal open={hoursOpen} onClose={() => setHoursOpen(false)} title="Horário de funcionamento">
      <div className="rounded-2xl bg-mist px-4 py-2">{days(est.openHours)}</div>
    </Modal>
  </ConsumerShell>;
}
