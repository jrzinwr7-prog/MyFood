import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Minus, Plus, ShoppingBag, Trash2, Tag, X, UtensilsCrossed } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { brl } from '../lib/format';
import { ConsumerShell } from '../components/Layout';
import { Button, Card, EmptyState, Input } from '../components/ui';
import { itemUnitCents } from '@myfood/shared';
import { DEMO_MODE } from '../lib/api';

export default function Cart() {
  const { cart, setCart, cartTotals, toast } = useApp();
  const [coupon, setCoupon] = useState(''); const [applied, setApplied] = useState('');
  const navigate = useNavigate();
  if (!cart || cart.items.length === 0) return <ConsumerShell><div className="pt-6"><EmptyState icon={<ShoppingBag />} title="Seu carrinho está vazio" text="Explore os estabelecimentos e escolha algo delicioso para começar."
    action={<Link to="/"><Button>Explorar estabelecimentos</Button></Link>} /></div></ConsumerShell>;

  const changeQty = (key: string, delta: number) => {
    const items = cart.items.map(i => i.key === key ? { ...i, quantity: i.quantity + delta } : i).filter(i => i.quantity > 0);
    setCart({ ...cart, items });
  };
  const discount = applied ? (cartTotals ? Math.min(cartTotals.subtotal_cents, applied.length <= 0 ? 0 : Math.round(cartTotals.subtotal_cents * 0.1)) : 0) : 0;
  void discount;

  return <ConsumerShell>
    <Link to={cart.establishmentSlug ? `/loja/${cart.establishmentSlug}` : '/'} className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold text-ink/50"><ArrowLeft size={15} />Continuar comprando</Link>
    <h1 className="mb-1 text-2xl font-black">Seu carrinho</h1>
    <p className="mb-6 text-sm text-ink/50">Pedido em <b className="text-ink">{cart.establishmentName}</b></p>
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-3">
        {cart.items.map(i => <Card key={i.key} className="flex gap-3 p-4">
          <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-cream text-2xl">{i.image_url ? <img src={i.image_url} className="h-full w-full object-cover" alt="" /> : <UtensilsCrossed size={23} className="text-[#ad8571]" />}</div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold">{i.name}</p>
            {i.options.length > 0 && <p className="mt-0.5 text-[11px] text-ink/50">{i.options.map(o => o.option_name).join(', ')}</p>}
            {i.notes && <p className="mt-0.5 text-[11px] italic text-ink/40">“{i.notes}”</p>}
            <p className="mt-2 text-sm font-black text-coral">{brl(itemUnitCents(i) * i.quantity)}</p>
          </div>
          <div className="flex flex-col items-end justify-between">
            <button aria-label={`Remover ${i.name}`} onClick={() => setCart({ ...cart, items: cart.items.filter(x => x.key !== i.key) })} className="text-ink/35 hover:text-red-500"><Trash2 size={17} /></button>
            <div className="flex items-center gap-2 rounded-xl bg-mist p-1">
              <button aria-label={`Diminuir quantidade de ${i.name}`} onClick={() => changeQty(i.key, -1)} className="grid h-7 w-7 place-items-center rounded-lg bg-white"><Minus size={13} /></button>
              <span className="w-5 text-center text-xs font-black">{i.quantity}</span>
              <button aria-label={`Aumentar quantidade de ${i.name}`} onClick={() => changeQty(i.key, 1)} className="grid h-7 w-7 place-items-center rounded-lg bg-white"><Plus size={13} /></button>
            </div>
          </div>
        </Card>)}
      </div>
      <div className="lg:sticky lg:top-24 lg:self-start">
        <Card className="p-5">
          <h2 className="mb-4 text-base font-extrabold">Resumo</h2>
          {!DEMO_MODE && <div className="mb-4"><Input label="Cupom de desconto (opcional)" value={coupon} onChange={e => setCoupon(e.target.value.toUpperCase())} placeholder="EX: MYFOOD10" />
            {applied && <p className="mt-1 text-[11px] font-bold text-mint">Cupom {applied} aplicado no próximo passo</p>}</div>}
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-ink/55">Subtotal</dt><dd className="font-bold">{brl(cartTotals?.subtotal_cents ?? 0)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink/55">Taxa de entrega</dt><dd className="font-bold">{brl(cart.deliveryFeeCents)}</dd></div>
            <div className="my-3 border-t border-dashed border-line" />
            <div className="flex justify-between text-lg"><dt className="font-extrabold">Total</dt><dd className="font-black text-coral">{brl(cartTotals?.total_cents ?? 0)}</dd></div>
          </dl>
          <Button className="mt-5 w-full" size="lg" onClick={() => navigate('/checkout', { state: { coupon: coupon || undefined } })}>Continuar para pagamento</Button>
          <p className="mt-3 text-center text-[11px] text-ink/45">{DEMO_MODE ? 'Valores fictícios para visualização; nenhum pedido será criado.' : 'O valor final é recalculado no servidor ao confirmar o pedido.'}</p>
        </Card>
      </div>
    </div>
  </ConsumerShell>;
}
