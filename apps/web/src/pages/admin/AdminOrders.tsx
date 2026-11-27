import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { brl, dt } from '../../lib/format';
import { useApp } from '../../state/AppContext';
import { DashShell } from '../../components/Layout';
import { Badge, Button, Card, EmptyState, Select, Spinner } from '../../components/ui';

const NEXT: Record<string, string[]> = { placed: ['accepted','cancelled'], awaiting_confirmation: ['accepted','cancelled'],
  accepted: ['preparing','cancelled'], preparing: ['awaiting_courier','cancelled'], awaiting_courier: ['cancelled'],
  courier_to_store: ['cancelled'], picked_up: ['on_the_way'], on_the_way: ['delivered'] };
export default function AdminOrders() {
  const { toast } = useApp(); const [items, setItems] = useState<any[] | null>(null); const [filter, setFilter] = useState('');
  const load = () => api.get(`/admin/orders${filter ? `?status=${filter}` : ''}`).then(r => setItems(r.items)).catch(() => setItems([]));
  useEffect(() => { load(); }, [filter]);
  async function change(id: string, status: string) {
    try { await api.post(`/admin/orders/${id}/status`, { status, reason: status === 'cancelled' ? 'Cancelado pela administração' : undefined }); toast('Status atualizado'); load(); }
    catch (e: any) { toast(e.message, 'error'); }
  }
  return <DashShell role="admin" title="Todos os pedidos">
    <div className="mb-4 flex flex-wrap gap-2">{['','placed','accepted','preparing','awaiting_courier','on_the_way','delivered','cancelled'].map(s =>
      <button key={s} onClick={() => setFilter(s)} className={`rounded-xl px-3 py-2 text-[11px] font-bold ${filter === s ? 'bg-ink text-white' : 'bg-white text-ink/55'}`}>{s || 'Todos'}</button>)}</div>
    {items === null ? <Spinner /> : items.length === 0 ? <EmptyState title="Nenhum pedido" text="Ajuste o filtro." /> :
      <div className="overflow-x-auto rounded-3xl border border-line bg-white"><table className="w-full text-left text-xs"><thead className="bg-mist text-ink/50"><tr>
        <th className="p-3">Pedido</th><th className="p-3">Cliente</th><th className="p-3">Loja</th><th className="p-3">Valor</th><th className="p-3">Status</th><th className="p-3">Ação</th></tr></thead>
        <tbody>{items.map(o => <tr key={o.id} className="border-t border-line"><td className="p-3 font-bold">#{o.id.slice(-6).toUpperCase()}<br /><span className="font-normal text-ink/40">{dt(o.created_at)}</span></td>
          <td className="p-3">{o.customer_name}</td><td className="p-3">{o.establishment_name}</td><td className="p-3 font-bold">{brl(o.total_cents)}</td>
          <td className="p-3"><Badge tone={o.status === 'delivered' ? 'green' : ['cancelled','failed'].includes(o.status) ? 'red' : 'blue'}>{o.status.replaceAll('_',' ')}</Badge></td>
          <td className="p-3">{NEXT[o.status]?.length ? <Select value="" onChange={e => e.target.value && change(o.id, e.target.value)}><option value="">Alterar…</option>
            {NEXT[o.status].map(s => <option key={s} value={s}>{s.replaceAll('_',' ')}</option>)}</Select> : <span className="text-ink/35">Finalizado</span>}</td></tr>)}</tbody></table></div>}
  </DashShell>;
}
