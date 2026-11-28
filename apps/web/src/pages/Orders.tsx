import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, Store, RotateCcw, MessageCircle } from 'lucide-react';
import { api } from '../lib/api';
import { brl, dt } from '../lib/format';
import { useApp } from '../state/AppContext';
import { ConsumerShell } from '../components/Layout';
import { Badge, Button, EmptyState, Spinner } from '../components/ui';

export default function Orders() {
  const { toast, setCart } = useApp();
  const navigate = useNavigate();
  const [items, setItems] = useState<any[] | null>(null);
  useEffect(() => { api.get('/orders/mine').then(r => setItems(r.items)).catch(() => setItems([])); }, []);
  async function repeat(order: any) {
    try {
      const d = await api.get(`/orders/${order.id}`);
      const slug = order.establishment_slug;
      const storeData = await api.get(`/catalog/establishments/${slug}`);
      const catalogIds = new Map(storeData.products.map((p: any) => [p.name, p.id]));
      const cartItems = d.items.map((i: any) => {
        const pid = catalogIds.get(i.name_snapshot) ?? i.product_id;
        const catalogProduct = storeData.products.find((p: any) => p.id === pid);
        const options = (i.selectedOptions ?? []).map((o: any) => {
          const group = (catalogProduct?.groups ?? []).find((g: any) =>
            (g.options ?? []).some((x: any) => x.name === o.optionName));
          const option = group?.options?.find((x: any) => x.name === o.optionName);
          return { group_name: o.groupName, option_name: o.optionName, price_cents: option?.priceCents ?? o.priceCents, option_id: option?.id };
        });
        return { key: `${pid}|${Date.now()}`, product_id: pid, name: i.name_snapshot, unit_price_cents: catalogProduct?.priceCents ?? Math.max(0, i.unit_price_cents - options.reduce((sum: number, o: any) => sum + o.price_cents, 0)),
          quantity: i.quantity, options: options.filter((o: any) => o.option_id), notes: i.notes, image_url: catalogProduct?.imageUrl ?? null };
      }).filter((i: any) => !!i.product_id);
      if (!cartItems.length) { toast('Produtos indisponíveis para repetir este pedido', 'error'); return; }
      setCart({ establishmentId: order.establishment_id, establishmentName: order.establishment_name, establishmentSlug: slug,
        deliveryFeeCents: storeData.establishment.deliveryFeeCents, items: cartItems });
      toast('Itens adicionados ao carrinho');
      navigate('/carrinho');
    } catch (e: any) { toast(e.message, 'error'); }
  }
  return <ConsumerShell>
    <h1 className="mb-1 text-2xl font-black">Meus pedidos</h1><p className="mb-6 text-sm text-ink/50">Acompanhe, repita e avalie suas compras.</p>
    {items === null ? <Spinner /> : items.length === 0 ? <EmptyState icon={<ShoppingBag />} title="Nenhum pedido ainda" text="Seu histórico aparecerá aqui depois do primeiro pedido." action={<Link to="/"><Button>Explorar lojas</Button></Link>} /> :
      <div className="space-y-3">{items.map(o => <div key={o.id} className="rounded-3xl border border-line bg-white p-4 shadow-card sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-2xl bg-coral/10 text-coral">{o.logo_url ? <img src={o.logo_url} alt="" className="h-full w-full object-cover" /> : <Store size={19} />}</span>
            <div><p className="text-sm font-extrabold">{o.establishment_name}</p><p className="text-[11px] text-ink/50">#{o.id.slice(-6).toUpperCase()} · {dt(o.created_at)} · {o.item_count} item(s)</p></div>
          </div>
          <div className="text-right"><Badge tone={o.status === 'delivered' ? 'green' : ['cancelled','failed'].includes(o.status) ? 'red' : 'blue'}>{o.statusLabel}</Badge><p className="mt-1.5 text-sm font-black">{brl(o.total_cents)}</p></div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to={`/pedido/${o.id}`}><Button size="sm" variant="dark">Acompanhar</Button></Link>
          <Button size="sm" variant="outline" onClick={() => repeat(o)}><RotateCcw size={14} />Repetir pedido</Button>
          {['delivered', 'cancelled'].includes(o.status) && <Link to="/conversas"><Button size="sm" variant="ghost"><MessageCircle size={14} />Conversas</Button></Link>}
        </div>
      </div>)}</div>}
  </ConsumerShell>;
}
