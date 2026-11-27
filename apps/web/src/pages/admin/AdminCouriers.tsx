import { useEffect, useState } from 'react';
import { Bike, Check, Power } from 'lucide-react';
import { api } from '../../lib/api';
import { useApp } from '../../state/AppContext';
import { DashShell } from '../../components/Layout';
import { Badge, Button, Card, EmptyState, Spinner } from '../../components/ui';

export default function AdminCouriers() {
  const { toast } = useApp(); const [items, setItems] = useState<any[] | null>(null);
  const load = () => api.get('/admin/couriers').then(r => setItems(r.items)).catch(() => setItems([]));
  useEffect(() => { load(); }, []);
  async function act(id: string, status: string) { try { await api.patch(`/admin/couriers/${id}`, { status }); toast('Status atualizado'); load(); } catch (e: any) { toast(e.message, 'error'); } }
  return <DashShell role="admin" title="Administração de entregadores">
    {items === null ? <Spinner /> : items.length === 0 ? <EmptyState title="Nenhum entregador" text="Cadastros aparecerão aqui." /> :
      <div className="space-y-3">{items.map(c => <Card key={c.id} className="flex flex-wrap items-center gap-4 p-5">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-coral/10 text-coral"><Bike size={19} /></span>
        <div className="min-w-[180px] flex-1"><p className="text-sm font-extrabold">{c.name}</p><p className="text-[11px] text-ink/50">{c.email} · {c.phone} · {c.document}</p>
          <p className="text-[11px] text-ink/45">{c.vehicle} · {c.vehicle_plate ?? 'sem placa'} · {c.rating_avg?.toFixed?.(1) ?? 0} ★</p></div>
        <Badge tone={c.status === 'approved' ? 'green' : c.status === 'pending' ? 'orange' : 'red'}>{c.status}</Badge>
        {c.status !== 'approved' && <Button size="sm" onClick={() => act(c.id, 'approved')}><Check size={14} />Aprovar</Button>}
        {c.status !== 'suspended' && <Button size="sm" variant="outline" onClick={() => act(c.id, 'suspended')}><Power size={14} />Suspender</Button>}
      </Card>)}</div>}
  </DashShell>;
}
