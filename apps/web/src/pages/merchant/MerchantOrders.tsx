import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bike, CheckCircle2, Clock3, MessageCircle, PackageCheck, XCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { brl, dt, phone } from '../../lib/format';
import { useRealtime } from '../../lib/realtime';
import { useApp } from '../../state/AppContext';
import { DashShell } from '../../components/Layout';
import { Badge, Button, Card, EmptyState, Modal, Spinner, Textarea } from '../../components/ui';

export default function MerchantOrders() {
  const { toast } = useApp();
  const [items, setItems] = useState<any[] | null>(null);
  const [filter, setFilter] = useState('');
  const [reject, setReject] = useState<any>(null); const [reason, setReason] = useState('');
  const load = useCallback(async () => {
    try { const r = await api.get(`/merchant/orders${filter ? `?status=${filter}` : ''}`); setItems(r.items); }
    catch { setItems([]); }
  }, [filter]);
  useEffect(() => { load(); const t = setInterval(load, 12000); return () => clearInterval(t); }, [load]);
  useRealtime((event) => { if (event === 'order:updated' || event === 'notification') load(); });

  async function act(order: any, path: string, body: any = {}) {
    try { await api.post(`/merchant/orders/${order.id}/${path}`, body); toast('Pedido atualizado'); load(); }
    catch (e: any) { toast(e.message, 'error'); }
  }
  return <DashShell role="merchant" title="Gerenciamento de pedidos">
    <div className="mb-4 flex flex-wrap gap-2">
      {[['','Todos'],['placed','Novos'],['accepted','Aceitos'],['preparing','Em preparo'],['awaiting_courier','Aguardando entregador'],['delivered','Entregues'],['cancelled','Cancelados']].map(([v, label]) =>
        <button key={v} onClick={() => setFilter(v)} className={`rounded-xl px-3 py-2 text-[11px] font-bold ${filter === v ? 'bg-ink text-white' : 'bg-white text-ink/55'}`}>{label}</button>)}
    </div>
    {items === null ? <Spinner /> : items.length === 0 ? <EmptyState title="Nenhum pedido encontrado" text="Novos pedidos aparecem aqui automaticamente, com notificação em tempo real." /> :
      <div className="space-y-3">{items.map(o => <Card key={o.id} className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-sm font-extrabold">Pedido #{o.id.slice(-6).toUpperCase()}</p>
            <p className="mt-0.5 text-[11px] text-ink/50">{dt(o.created_at)} · {o.customer_name} · {phone(o.customer_phone)}</p></div>
          <div className="text-right"><Badge tone={o.status === 'delivered' ? 'green' : ['cancelled','failed'].includes(o.status) ? 'red' : 'blue'}>{o.status.replaceAll('_',' ')}</Badge><p className="mt-1 text-sm font-black">{brl(o.total_cents)}</p></div>
        </div>
        <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
          <div className="rounded-2xl bg-mist p-3"><p className="font-extrabold text-ink/60">Entrega</p><p className="mt-1">{o.address_label}: {o.street}, {o.number} · {o.neighborhood}</p><p className="text-ink/45">{o.city}/{o.state} · {o.customer_phone}</p></div>
          <div className="rounded-2xl bg-mist p-3"><p className="font-extrabold text-ink/60">Entregador</p><p className="mt-1">{o.courier_name ?? 'Ainda não designado'}</p><p className="text-ink/45">{o.delivery_status?.replaceAll('_',' ') ?? ''}</p></div>
        </div>
        {o.notes && <p className="mt-2 text-xs italic text-ink/50">Observação: {o.notes}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {o.status === 'placed' && <><Button size="sm" onClick={() => act(o, 'accept')}><CheckCircle2 size={14} />Aceitar pedido</Button>
            <Button size="sm" variant="outline" onClick={() => { setReject(o); setReason(''); }}><XCircle size={14} />Recusar</Button></>}
          {o.status === 'accepted' && <Button size="sm" onClick={() => act(o, 'status', { status: 'preparing' })}><Clock3 size={14} />Iniciar preparo</Button>}
          {o.status === 'preparing' && <Button size="sm" onClick={() => act(o, 'status', { status: 'awaiting_courier' })}><PackageCheck size={14} />Marcar pronto</Button>}
          {['accepted','preparing','awaiting_courier'].includes(o.status) && <Button size="sm" variant="dark" onClick={() => act(o, 'request-courier')}><Bike size={14} />Solicitar entregador</Button>}
          <Link to="/conversas"><Button size="sm" variant="ghost"><MessageCircle size={14} />Conversas</Button></Link>
        </div>
      </Card>)}</div>}
    <Modal open={!!reject} onClose={() => setReject(null)} title="Recusar pedido">
      <Textarea label="Motivo da recusa" rows={3} value={reason} onChange={e => setReason(e.target.value)} />
      <Button variant="danger" className="mt-4 w-full" onClick={() => { act(reject, 'reject', { reason }); setReject(null); }}>Confirmar recusa</Button>
    </Modal>
  </DashShell>;
}
