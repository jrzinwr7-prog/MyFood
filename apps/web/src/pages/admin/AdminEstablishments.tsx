import { useCallback, useEffect, useState } from 'react';
import { Check, Store, X } from 'lucide-react';
import { api } from '../../lib/api';
import { brl } from '../../lib/format';
import { useApp } from '../../state/AppContext';
import { DashShell } from '../../components/Layout';
import { Badge, Button, Card, EmptyState, Spinner } from '../../components/ui';

export default function AdminEstablishments() {
  const { toast } = useApp(); const [items, setItems] = useState<any[] | null>(null); const [filter, setFilter] = useState(''); const [featured, setFeatured] = useState<Record<string, boolean>>({});
  const load = useCallback(() => api.get(`/admin/establishments${filter ? `?status=${filter}` : ''}`).then(r => setItems(r.items)).catch(() => setItems([])), [filter]);
  useEffect(() => { load(); }, [load]);
  async function act(id: string, status: string) {
    try { await api.patch(`/admin/establishments/${id}`, { status }); toast('Status atualizado e establishments notificado'); load(); }
    catch (e: any) { toast(e.message, 'error'); }
  }
  return <DashShell role="admin" title="Estabelecimentos">
    <div className="mb-4 flex flex-wrap gap-2">{['','pending','approved','suspended','rejected'].map(s => <button key={s} onClick={() => setFilter(s)}
      className={`rounded-xl px-3 py-2 text-[11px] font-bold ${filter === s ? 'bg-ink text-white' : 'bg-white text-ink/55'}`}>{s || 'Todos'}</button>)}</div>
    {items === null ? <Spinner /> : items.length === 0 ? <EmptyState title="Nenhum estabelecimento" text="Cadastros aparecerão aqui para análise." /> :
      <div className="space-y-3">{items.map(e => <Card key={e.id} className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-coral/10 text-coral"><Store size={19} /></span>
            <div><p className="text-sm font-extrabold">{e.name}</p><p className="text-[11px] text-ink/50">{e.owner_name} · {e.owner_email} · {e.city}/{e.state}</p></div></div>
          <Badge tone={e.status === 'approved' ? 'green' : e.status === 'pending' ? 'orange' : 'red'}>{e.status}</Badge>
        </div>
        <div className="mt-3 grid gap-2 text-[11px] text-ink/55 sm:grid-cols-3">
          <span>Documento: {e.document}</span><span>Taxa entrega: {brl(e.delivery_fee_cents)}</span><span>Comissão: {(e.commission_products_bps / 100).toFixed(1)}% / {(e.commission_delivery_bps / 100).toFixed(1)}%</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {e.status !== 'approved' && <Button size="sm" onClick={() => act(e.id, 'approved')}><Check size={14} />Aprovar</Button>}
          {e.status !== 'suspended' && <Button size="sm" variant="outline" onClick={() => act(e.id, 'suspended')}>Suspender</Button>}
          {e.status !== 'pending' && <Button size="sm" variant="outline" onClick={() => act(e.id, 'pending')}>Voltar a pendente</Button>}
          <Button size="sm" variant="danger" onClick={() => { if (confirm('Recusar cadastro?')) act(e.id, 'rejected'); }}><X size={14} />Recusar</Button>
          <Button size="sm" variant="ghost" onClick={async () => {
            try { const next = { ...featured, [e.id]: !featured[e.id] }; await api.patch('/admin/settings', { featured: next }); setFeatured(next); toast('Destaque atualizado'); }
            catch (err: any) { toast(err.message, 'error'); }
          }}>{featured[e.id] ? '★ Remover destaque' : '☆ Destacar'}</Button>
        </div>
      </Card>)}</div>}
  </DashShell>;
}
