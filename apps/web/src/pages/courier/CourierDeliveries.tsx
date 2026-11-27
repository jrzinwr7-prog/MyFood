import { useCallback, useEffect, useState } from 'react';
import { Bike, CheckCircle2, MapPin, Navigation, PackageCheck } from 'lucide-react';
import { api } from '../../lib/api';
import { brl, dt } from '../../lib/format';
import { useRealtime } from '../../lib/realtime';
import { useApp } from '../../state/AppContext';
import { DashShell } from '../../components/Layout';
import { Badge, Button, Card, EmptyState, Spinner } from '../../components/ui';

export default function CourierDeliveries() {
  const { toast } = useApp(); const [items, setItems] = useState<any[] | null>(null);
  const load = useCallback(() => api.get('/couriers/deliveries').then(r => setItems(r.items)).catch(() => setItems([])), []);
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);
  useRealtime((event) => { if (event === 'delivery:updated' || event === 'order:updated') load(); });
  async function act(id: string, action: string) {
    try { await api.post(`/couriers/deliveries/${id}/${action}`, action === 'location' ? { latitude: -12.556, longitude: -41.551 } : {});
      toast('Status atualizado'); load(); } catch (e: any) { toast(e.message, 'error'); }
  }
  return <DashShell role="courier" title="Minhas entregas">
    {items === null ? <Spinner /> : items.length === 0 ? <EmptyState icon={<Bike />} title="Nenhuma entrega ainda" text="Aceite uma solicitação para ver os detalhes aqui." /> :
      <div className="grid gap-3 md:grid-cols-2">{items.map(d => <Card key={d.id} className="p-5">
        <div className="flex justify-between gap-2"><div><p className="text-sm font-extrabold">#{d.id.slice(-6).toUpperCase()} · {d.establishment_name}</p><p className="text-[11px] text-ink/45">{dt(d.created_at)} · {brl(d.fee_cents)}</p></div>
          <Badge tone={d.status === 'delivered' ? 'green' : 'blue'}>{d.status.replaceAll('_',' ')}</Badge></div>
        <div className="mt-3 space-y-2 rounded-2xl bg-mist p-3 text-xs">
          <p className="flex gap-2"><MapPin size={14} className="shrink-0 text-coral" /><span><b>Retirada:</b> {d.pickup_street}, {d.pickup_number}, {d.pickup_neighborhood}</span></p>
          <p className="flex gap-2"><Navigation size={14} className="shrink-0 text-coral" /><span><b>Entrega:</b> {d.dest_street}, {d.dest_number}, {d.dest_neighborhood} — {d.dest_city}</span></p>
        </div>
        {d.status === 'accepted' && <div className="mt-4 flex flex-wrap gap-2"><Button size="sm" onClick={() => act(d.id, 'picked')}><PackageCheck size={14} />Confirmar retirada</Button>
          <Button size="sm" variant="outline" onClick={() => act(d.id, 'location')}>Compartilhar localização</Button></div>}
        {d.status === 'picked_up' && <div className="mt-4 flex flex-wrap gap-2"><Button size="sm" onClick={() => act(d.id, 'depart')}><Navigation size={14} />Sai para entrega</Button>
          <Button size="sm" variant="outline" onClick={() => act(d.id, 'location')}>Atualizar localização</Button></div>}
        {d.status === 'on_the_way' && <div className="mt-4 flex flex-wrap gap-2"><Button size="sm" onClick={() => act(d.id, 'delivered')}><CheckCircle2 size={14} />Confirmar entrega</Button>
          <Button size="sm" variant="outline" onClick={() => act(d.id, 'location')}>Atualizar localização</Button></div>}
      </Card>)}</div>}
  </DashShell>;
}
