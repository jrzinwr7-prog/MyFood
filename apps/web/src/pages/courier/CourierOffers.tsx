import { useCallback, useEffect, useState } from 'react';
import { Bike, MapPin, Navigation, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api';
import { brl } from '../../lib/format';
import { useRealtime } from '../../lib/realtime';
import { useApp } from '../../state/AppContext';
import { DashShell } from '../../components/Layout';
import { Button, Card, EmptyState, Spinner } from '../../components/ui';

export default function CourierOffers() {
  const { toast } = useApp(); const [items, setItems] = useState<any[] | null>(null); const [busy, setBusy] = useState('');
  const load = useCallback(() => api.get('/couriers/offers').then(r => setItems(r.items)).catch(() => setItems([])), []);
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);
  useRealtime((event) => { if (event === 'delivery:offer' || event === 'order:updated') load(); });
  async function accept(id: string) {
    setBusy(id);
    try { const r = await api.post(`/couriers/offers/${id}/accept`, {}); setItems(prev => (prev ?? []).filter(x => x.id !== id)); toast('Entrega aceita! Confira o endereço de retirada.'); void r; }
    catch (e: any) { toast(e.message, 'error'); load(); } finally { setBusy(''); }
  }
  return <DashShell role="courier" title="Solicitações de entrega">
    <div className="mb-4 flex items-center justify-between"><p className="text-xs text-ink/50">Solicitações disponíveis; a localização do entregador pode não estar atualizada.</p><Button size="sm" variant="outline" onClick={load}><RefreshCw size={14} />Atualizar</Button></div>
    {items === null ? <Spinner /> : items.length === 0 ? <EmptyState icon={<Bike />} title="Sem solicitações no momento" text="Fique online e aguarde: novas solicitações aparecem automaticamente aqui." /> :
      <div className="grid gap-3 md:grid-cols-2">{items.map(o => <Card key={o.id} className="p-5">
        <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-extrabold">{o.establishment_name}</p><p className="text-[11px] text-ink/45">Pedido #{o.order_id?.slice(-6).toUpperCase()}</p></div><b className="text-lg font-black text-coral">{brl(o.fee_cents)}</b></div>
        <div className="mt-4 space-y-2 rounded-2xl bg-mist p-3 text-xs">
          <p className="flex gap-2"><MapPin size={15} className="shrink-0 text-coral" /><span><b>Retirada:</b> {o.pickup_street}, {o.pickup_number} — {o.pickup_neighborhood}</span></p>
          <p><b>Região de entrega:</b> {o.dest_neighborhood}, {o.dest_city}/{o.dest_state}</p>
          <p>Valor mostrado: taxa bruta da entrega, não necessariamente o ganho líquido.</p>
          {o.distanceKm != null && <p className="flex gap-2"><Navigation size={15} className="shrink-0 text-coral" /><span>Distância até a loja: <b>{o.distanceKm} km</b></span></p>}
        </div>
        <div className="mt-4 flex gap-2"><Button className="flex-1" loading={busy === o.id} onClick={() => accept(o.id)}>Aceitar entrega</Button>
          <Button variant="outline" onClick={() => setItems(prev => (prev ?? []).filter(x => x.id !== o.id))}>Recusar</Button></div>
      </Card>)}</div>}
  </DashShell>;
}
