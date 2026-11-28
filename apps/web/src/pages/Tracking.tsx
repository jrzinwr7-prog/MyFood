import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Bike, Check, CheckCircle2, Clock3, MessageCircle, PackageCheck, Star, Store, XCircle, Navigation } from 'lucide-react';
import { api } from '../lib/api';
import { brl, dt } from '../lib/format';
import { useRealtime } from '../lib/realtime';
import { useApp } from '../state/AppContext';
import { ConsumerShell } from '../components/Layout';
import { Badge, Button, Card, Modal, Spinner, Textarea } from '../components/ui';

const STEPS = [
  { key: 'placed', label: 'Pedido realizado', icon: CheckCircle2 },
  { key: 'accepted', label: 'Pedido aceito', icon: Store },
  { key: 'preparing', label: 'Em preparação', icon: Clock3 },
  { key: 'awaiting_courier', label: 'Aguardando entregador', icon: Bike },
  { key: 'courier_to_store', label: 'Entregador indo retirar', icon: Navigation },
  { key: 'picked_up', label: 'Pedido retirado', icon: PackageCheck },
  { key: 'on_the_way', label: 'A caminho de você', icon: Bike },
  { key: 'delivered', label: 'Entregue', icon: Check },
];
const ORDER_INDEX: Record<string, number> = Object.fromEntries(STEPS.map((s, i) => [s.key, i]));

export default function Tracking() {
  const { id } = useParams(); const { toast } = useApp();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [rating, setRating] = useState(5); const [comment, setComment] = useState('');
  const load = useCallback(async () => {
    try { const r = await api.get(`/orders/${id}`); setData(r); setError(''); }
    catch (e: any) { setError(e.message); }
  }, [id]);
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);
  useRealtime((event, payload) => { if (event === 'order:updated' && payload?.orderId === id) load(); if (event === 'delivery:location' && payload?.orderId === id) load(); });

  if (error && !data) return <ConsumerShell><div className="rounded-3xl bg-white p-8 text-center"><h2 className="font-extrabold">Não foi possível carregar o pedido</h2><p className="mt-2 text-sm text-ink/55">{error}</p><Link to="/pedidos" className="mt-4 inline-block text-sm font-bold text-coral underline">Ver meus pedidos</Link></div></ConsumerShell>;
  if (!data) return <ConsumerShell><Spinner label="Acompanhando pedido…" /></ConsumerShell>;
  const { order, items, history, delivery, payment, conversationId } = data;
  const current = ORDER_INDEX[order.status] ?? -1;
  const failed = ['cancelled', 'failed'].includes(order.status);

  async function submitReview(targetType: 'establishment' | 'courier') {
    try { await api.post(`/orders/${id}/review`, { targetType, rating, comment }); setReviewOpen(false); toast('Avaliação enviada. Obrigado!'); load(); }
    catch (e: any) { toast(e.message, 'error'); }
  }

  return <ConsumerShell>
    <Link to="/pedidos" className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold text-ink/50"><ArrowLeft size={15} />Meus pedidos</Link>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-black tracking-tight">Pedido #{order.id.slice(-6).toUpperCase()}</h1>
        <p className="mt-1 text-xs text-ink/50">{order.establishment_name} · {dt(order.created_at)}</p></div>
      <Badge tone={failed ? 'red' : order.status === 'delivered' ? 'green' : 'blue'}>{order.statusLabel}</Badge>
    </div>

    {payment?.status === 'pending' && <Card className="mb-5 border-coral/30 bg-coral/5 p-5">
      <div className="flex items-start gap-3"><Clock3 className="mt-0.5 shrink-0 text-coral" size={20} />
        <div><h3 className="text-sm font-extrabold">Pagamento pendente de confirmação</h3>
          <p className="mt-1 text-xs text-ink/60">Este pedido usa {payment.method === 'cash' ? 'dinheiro na entrega' : 'PIX manual'}. O estabelecimento confirmará o recebimento antes do fechamento financeiro. Nenhum pagamento foi debitado automaticamente.</p>
          <p className="mt-2 text-xs font-bold">Valor: {brl(payment.amount_cents)}</p></div></div>
    </Card>}

    {failed && <Card className="mb-5 border-red-200 bg-red-50 p-5 text-sm text-red-700"><b>Pedido {order.status === 'cancelled' ? 'cancelado' : 'com falha'}.</b> {order.cancellation_reason || 'Entre em contato com o estabelecimento para detalhes.'}</Card>}

    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <Card className="p-5 sm:p-7">
        <h2 className="mb-6 text-base font-extrabold">Acompanhamento em tempo real</h2>
        {failed ? <div className="flex items-center gap-3 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-600"><XCircle size={20} />{order.statusLabel}</div> :
          <ol className="relative space-y-5 border-l-2 border-line pl-6">
            {STEPS.map((s, i) => {
              const done = i <= current; const active = i === current;
              return <li key={s.key} className="relative">
                <span className={`absolute -left-[35px] grid h-8 w-8 place-items-center rounded-full border-2 ${done ? 'border-coral bg-coral text-white' : 'border-line bg-white text-ink/30'}`}><s.icon size={15} /></span>
                <p className={`text-sm font-bold ${done ? 'text-ink' : 'text-ink/35'}`}>{s.label}</p>
                {active && <p className="mt-0.5 text-[11px] font-bold text-coral">Etapa atual</p>}
                {history.find((h: any) => h.to_status === s.key) && <p className="mt-0.5 text-[11px] text-ink/40">{dt(history.find((h: any) => h.to_status === s.key).created_at)}</p>}
              </li>;
            })}
          </ol>}
      </Card>
      <div className="space-y-4">
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-extrabold">Resumo</h2>
          <div className="space-y-2 text-xs">{items.map((i: any) => <div key={i.id} className="flex justify-between gap-2"><span className="text-ink/55">{i.quantity}× {i.name_snapshot}</span><b>{brl(i.total_cents)}</b></div>)}</div>
          <div className="mt-3 space-y-1.5 border-t border-line pt-3 text-xs">
            <div className="flex justify-between text-ink/55"><span>Subtotal</span><span>{brl(order.subtotal_cents)}</span></div>
            {order.discount_cents > 0 && <div className="flex justify-between text-mint"><span>Desconto</span><span>- {brl(order.discount_cents)}</span></div>}
            <div className="flex justify-between text-ink/55"><span>Entrega</span><span>{brl(order.delivery_fee_cents)}</span></div>
            <div className="flex justify-between text-base font-black"><span>Total</span><span className="text-coral">{brl(order.total_cents)}</span></div>
          </div>
        </Card>
        {delivery?.courier_name && <Card className="p-5">
          <h2 className="mb-3 text-sm font-extrabold">Seu entregador</h2>
          <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-full bg-coral/10 text-coral"><Bike size={20} /></span>
            <div><p className="text-sm font-bold">{delivery.courier_name}</p><p className="text-[11px] text-ink/50">{phoneBR(delivery.courier_phone)}</p></div></div>
        </Card>}
        {conversationId && <Link to={`/conversas?c=${conversationId}`} className="flex items-center justify-between rounded-2xl bg-ink px-5 py-4 text-sm font-bold text-white"><span className="flex items-center gap-2"><MessageCircle size={17} />Conversar com a loja</span><span>→</span></Link>}
        {order.status === 'delivered' && <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => { setRating(5); setReviewOpen(true); }}>Avaliar loja</Button>
          {delivery?.courier_id && <Button variant="outline" onClick={() => { setRating(5); setReviewOpen(true); }}>Avaliar entregador</Button>}
        </div>}
      </div>
    </div>
    <Modal open={reviewOpen} onClose={() => setReviewOpen(false)} title="Como foi sua experiência?">
      <div className="mb-4 flex justify-center gap-2">{[1,2,3,4,5].map(n => <button key={n} type="button" aria-label={`${n} ${n === 1 ? 'estrela' : 'estrelas'}`} aria-pressed={rating === n} onClick={() => setRating(n)} className="grid h-11 w-11 place-items-center rounded-xl text-tangerine hover:bg-cream"><Star size={27} fill={n <= rating ? 'currentColor' : 'none'} /></button>)}</div>
      <Textarea label="Deixe um comentário (opcional)" rows={3} value={comment} onChange={e => setComment(e.target.value)} />
      <div className="mt-4 grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => submitReview('courier')}>Avaliar entregador</Button><Button onClick={() => submitReview('establishment')}>Avaliar loja</Button></div>
    </Modal>
  </ConsumerShell>;
}
function phoneBR(v: string) { const d = (v ?? '').replace(/\D/g, ''); return d.length === 11 ? `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}` : v ?? ''; }
