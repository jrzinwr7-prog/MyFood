import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Banknote, CreditCard, MapPin, Plus, QrCode, ShieldCheck, Check } from 'lucide-react';
import { api, API_ORIGIN, DEMO_MODE } from '../lib/api';
import { brl, cepMask } from '../lib/format';
import { useApp } from '../state/AppContext';
import { ConsumerShell } from '../components/Layout';
import { Button, Card, EmptyState, Input, Modal, Select } from '../components/ui';

export default function Checkout() {
  const { cart, cartTotals, setCart, toast, user } = useApp();
  const nav = useNavigate(); const location = useLocation(); const coupon = (location.state as any)?.coupon;
  const [addresses, setAddresses] = useState<any[]>([]);
  const [addressId, setAddressId] = useState('');
  const [method, setMethod] = useState('pix_manual');
  const [creating, setCreating] = useState(false);
  const [onlineCards, setOnlineCards] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState({ label: 'Casa', cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: 'BA' });
  const [accept, setAccept] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/catalog/public').then(p => setOnlineCards(p.features?.onlineCards === true)).catch(() => {});
    if (!user) { nav('/entrar'); return; }
    api.get('/addresses').then(r => {
      setAddresses(r.items);
      const def = r.items.find((a: any) => a.is_default) ?? r.items[0];
      if (def) setAddressId(def.id); else setNewOpen(true);
    }).catch(() => {});
  }, [user?.id]);

  async function lookupCep() {
    const digits = form.cep.replace(/\D/g, '');
    if (digits.length !== 8) return;
    try { const r = await api.get(`/catalog/cep/${digits}`); setForm(f => ({ ...f, ...r, street: r.street || f.street, city: r.city, state: r.state, neighborhood: r.neighborhood })); toast('Endereço encontrado'); }
    catch (e: any) { toast(e.message, 'error'); }
  }
  async function saveAddress() {
    try {
      const r = await api.post('/addresses', { ...form, latitude: null, longitude: null, isDefault: addresses.length === 0 });
      setAddresses(a => [...a, r.address]); setAddressId(r.address.id); setNewOpen(false); toast('Endereço salvo');
    } catch (e: any) { toast(e.message, 'error'); }
  }
  async function confirm() {
    if (DEMO_MODE) { setError('Demonstração encerrada antes do pagamento. Nenhum pedido foi criado.'); return; }
    if (!accept || !cart || !addressId) { setError('Aceite os termos e selecione um endereço.'); return; }
    setCreating(true); setError('');
    try {
      const order = await api.post('/orders', { establishmentId: cart.establishmentId, addressId, paymentMethod: method,
        couponCode: coupon, items: cart.items.map(i => ({ productId: i.product_id, quantity: i.quantity, notes: i.notes,
          selectedOptions: i.options.filter(o => !!o.option_id).map(o => ({ optionId: o.option_id })) })) });
      let checkoutUrl: string | null = null;
      try {
        const payment: any = await fetch(`${API_ORIGIN}/api/payments/orders/${order.order.id}/initialize`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('myfood_token')}`,
            'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ method }),
        }).then(async r => ({ ok: r.ok, data: await r.json() }));
        if (!payment.ok) throw new Error(payment.data?.error ?? 'Falha ao iniciar pagamento');
        checkoutUrl = payment.data.checkoutUrl ?? null;
      } catch (e: any) { toast(`Pedido criado, mas o pagamento não foi iniciado: ${e.message}`, 'error'); }
      setCart(null);
      if (checkoutUrl) window.location.href = checkoutUrl;
      else nav(`/pedido/${order.order.id}`);
    } catch (e: any) { setError(e.message); setCreating(false); }
  }

  if (!cart || cart.items.length === 0) return <ConsumerShell><div className="pt-6"><EmptyState title="Carrinho vazio" text="Adicione produtos antes de finalizar." action={<Link to="/"><Button>Explorar lojas</Button></Link>} /></div></ConsumerShell>;

  return <ConsumerShell>
    <Link to="/carrinho" className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold text-ink/50"><ArrowLeft size={15} />Voltar ao carrinho</Link>
    <h1 className="mb-6 text-2xl font-black">Finalizar pedido</h1>
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-5">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-base font-extrabold">Endereço de entrega</h2>
            {!DEMO_MODE && <button onClick={() => setNewOpen(true)} className="flex items-center gap-1 text-xs font-bold text-coral"><Plus size={14} />Novo endereço</button>}</div>
          {addresses.length === 0 && !newOpen ? <p className="text-sm text-ink/50">Cadastre um endereço para continuar.</p> :
            <div className="space-y-2">{addresses.map(a => <button key={a.id} onClick={() => setAddressId(a.id)} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left ${addressId === a.id ? 'border-coral bg-coral/5' : 'border-line'}`}>
              <MapPin size={18} className={addressId === a.id ? 'text-coral' : 'text-ink/40'} />
              <span className="text-xs"><b className="block text-sm">{a.label}</b>{a.street}, {a.number} · {a.neighborhood}, {a.city}/{a.state} · CEP {a.cep}</span>
              {addressId === a.id && <Check size={16} className="ml-auto text-coral" />}</button>)}</div>}
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 text-base font-extrabold">Forma de pagamento</h2>
          <div className="space-y-2">
            <button onClick={() => setMethod('pix_manual')} className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left ${method === 'pix_manual' ? 'border-coral bg-coral/5' : 'border-line'}`}>
              <QrCode size={20} className="text-coral" /><span className="text-xs"><b className="block text-sm">PIX manual</b>Você recebe as instruções e o estabelecimento confirma o recebimento.</span></button>
            <button onClick={() => setMethod('cash')} className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left ${method === 'cash' ? 'border-coral bg-coral/5' : 'border-line'}`}>
              <Banknote size={20} className="text-coral" /><span className="text-xs"><b className="block text-sm">Dinheiro na entrega</b>Pagamento confirmado pelo estabelecimento.</span></button>
            {onlineCards && <>
              <button onClick={() => setMethod('pix')} className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left ${method === 'pix' ? 'border-coral bg-coral/5' : 'border-line'}`}>
                <QrCode size={20} className="text-coral" /><span className="text-xs"><b className="block text-sm">PIX online</b>Confirmação automática via provedor.</span></button>
              <button onClick={() => setMethod('credit_card')} className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left ${method === 'credit_card' ? 'border-coral bg-coral/5' : 'border-line'}`}>
                <CreditCard size={20} className="text-coral" /><span className="text-xs"><b className="block text-sm">Cartão de crédito</b>Checkout seguro do provedor.</span></button>
              <button onClick={() => setMethod('debit_card')} className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left ${method === 'debit_card' ? 'border-coral bg-coral/5' : 'border-line'}`}>
                <CreditCard size={20} className="text-coral" /><span className="text-xs"><b className="block text-sm">Cartão de débito</b>Quando suportado pelo provedor.</span></button>
            </>}
          </div>
          {!onlineCards && <p className="mt-3 rounded-xl bg-mist p-3 text-[11px] text-ink/55">Pagamentos online ainda não estão disponíveis; dependem de integração e testes com um provedor.</p>}
        </Card>
      </div>
      <div className="lg:sticky lg:top-24 lg:self-start">
        <Card className="p-5">
          <h2 className="mb-4 text-base font-extrabold">Resumo do pedido</h2>
          <div className="mb-4 max-h-48 space-y-2 overflow-y-auto text-xs">
            {cart.items.map(i => <div key={i.key} className="flex justify-between gap-2"><span className="text-ink/60">{i.quantity}× {i.name}{i.options.length ? ` (${i.options.map(o => o.option_name).join(', ')})` : ''}</span>
              <span className="shrink-0 font-bold">{brl((i.unit_price_cents + i.options.reduce((s, o) => s + o.price_cents, 0)) * i.quantity)}</span></div>)}
          </div>
          <dl className="space-y-2 border-t border-line pt-3 text-sm">
            <div className="flex justify-between"><dt className="text-ink/55">Subtotal</dt><dd>{brl(cartTotals?.subtotal_cents ?? 0)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink/55">Entrega</dt><dd>{brl(cart.deliveryFeeCents)}</dd></div>
            <div className="flex justify-between text-lg font-black"><dt>Total</dt><dd className="text-coral">{brl(cartTotals?.total_cents ?? 0)}</dd></div>
          </dl>
          {!DEMO_MODE && <label className="mt-4 flex items-start gap-2 text-[11px] text-ink/60"><input type="checkbox" checked={accept} onChange={e => setAccept(e.target.checked)} className="mt-0.5 accent-coral" />Li e aceito os <Link className="text-coral underline" to="/termos">termos de uso</Link> e a <Link className="text-coral underline" to="/privacidade">política de privacidade</Link>.</label>}
          {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-600">{error}</p>}
          {DEMO_MODE ? <p role="status" className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">Fim da demonstração: nenhum pedido será criado e nenhum pagamento será realizado.</p> : <Button className="mt-4 w-full" size="lg" loading={creating} onClick={confirm}><ShieldCheck size={17} />Confirmar pedido</Button>}
        </Card>
      </div>
    </div>

    <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Novo endereço">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Identificação" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="Casa, Trabalho…" />
        <Input label="CEP" value={form.cep} onChange={e => setForm({ ...form, cep: cepMask(e.target.value) })} onBlur={lookupCep} placeholder="00000-000" />
        <div className="sm:col-span-2"><Input label="Rua / Avenida" value={form.street} onChange={e => setForm({ ...form, street: e.target.value })} /></div>
        <Input label="Número" value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} />
        <Input label="Complemento" value={form.complement} onChange={e => setForm({ ...form, complement: e.target.value })} />
        <Input label="Bairro" value={form.neighborhood} onChange={e => setForm({ ...form, neighborhood: e.target.value })} />
        <Input label="Cidade" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
        <Select label="UF" value={form.state} onChange={e => setForm({ ...form, state: e.target.value })}>{['BA','SP','RJ','MG','ES'].map(s => <option key={s}>{s}</option>)}</Select>
      </div>
      <Button className="mt-5 w-full" onClick={saveAddress}>Salvar endereço</Button>
    </Modal>
  </ConsumerShell>;
}
