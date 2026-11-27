import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Bike, CheckCircle2, CircleDollarSign, MapPin, Power } from 'lucide-react';
import { api } from '../../lib/api';
import { brl, dt } from '../../lib/format';
import { useRealtime } from '../../lib/realtime';
import { useApp } from '../../state/AppContext';
import { DashShell } from '../../components/Layout';
import { Badge, Button, Card, EmptyState, Spinner, StatCard } from '../../components/ui';

export default function CourierDashboard() {
  const { toast } = useApp();
  const [me, setMe] = useState<any>(null); const [earnings, setEarnings] = useState<any>(null);
  const [offers, setOffers] = useState<any[]>([]); const [deliveries, setDeliveries] = useState<any[]>([]);
  const load = useCallback(async () => {
    try {
      const [m, e, o, d] = await Promise.all([api.get('/couriers/me'), api.get('/couriers/earnings'), api.get('/couriers/offers'), api.get('/couriers/deliveries')]);
      setMe(m); setEarnings(e); setOffers(o.items); setDeliveries(d.items);
    } catch { /* guard de perfil */ }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [load]);
  useRealtime((event) => { if (event === 'delivery:offer' || event === 'delivery:updated' || event === 'order:updated') load(); });
  async function toggleOnline() {
    try { await api.patch('/couriers/me', { online: !me.courier.online,
      latitude: -12.555, longitude: -41.55 }); load(); toast(me.courier.online ? 'Você está offline' : 'Você está online!'); }
    catch (e: any) { toast(e.message, 'error'); }
  }
  async function accept(id: string) {
    try { await api.post(`/couriers/offers/${id}/accept`, {}); toast('Entrega aceita! Siga para a retirada.'); load(); }
    catch (e: any) { toast(e.message, 'error'); }
  }
  const active = deliveries.filter(d => ['accepted','picked_up','on_the_way'].includes(d.status));
  if (!me) return <DashShell role="courier" title="Painel do entregador"><Spinner /></DashShell>;
  return <DashShell role="courier" title="Painel do entregador">
    {me.courier.status === 'pending' && <div className="mb-5 flex items-start gap-3 rounded-3xl border border-orange-200 bg-orange-50 p-5">
      <AlertCircle className="text-orange-600" size={20} /><div><b className="text-sm text-orange-800">Cadastro em análise</b>
        <p className="mt-1 text-xs text-orange-700">A administradora irá aprovar seu cadastro antes que você possa aceitar entregas.</p></div></div>}
    {me.courier.status === 'approved' && <button onClick={toggleOnline} className={`mb-5 flex w-full items-center justify-between rounded-3xl p-6 text-white shadow-float transition ${me.courier.online ? 'bg-gradient-to-r from-mint to-emerald-500' : 'bg-ink'}`}>
      <span className="flex items-center gap-3"><Power size={24} /><span className="text-left"><b className="block text-lg font-black">{me.courier.online ? 'Você está ONLINE' : 'Você está OFFLINE'}</b>
        <span className="text-xs text-white/70">{me.courier.online ? 'Recebendo solicitações da região' : 'Toque para receber solicitações'}</span></span></span>
      <span className={`h-4 w-4 rounded-full ${me.courier.online ? 'bg-white' : 'bg-white/30'}`} /></button>}
    <div className="grid gap-3 sm:grid-cols-3">
      <StatCard label="Ganhos acumulados" value={brl(earnings?.totals?.earnings ?? 0)} hint="Repasses registrados" icon={<CircleDollarSign size={19} />} tone="mint" />
      <StatCard label="Entregas concluídas" value={String(earnings?.delivered ?? 0)} hint="Todo o histórico" icon={<CheckCircle2 size={19} />} tone="blue" />
      <StatCard label="Avaliação média" value={Number(me.courier.rating_avg ?? 0).toFixed(1)} hint={`${me.courier.rating_count} avaliações`} icon={<Bike size={19} />} />
    </div>
    <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <Card className="p-5"><div className="mb-4 flex items-center justify-between"><h2 className="text-base font-extrabold">Solicitações disponíveis</h2><Link to="/courier/solicitacoes" className="text-xs font-bold text-coral">Ver todas →</Link></div>
        {offers.length === 0 ? <EmptyState icon={<MapPin />} title="Nenhuma solicitação" text={me.courier.online ? 'Aguarde novas solicitações da região. Elas chegam em tempo real.' : 'Fique online para receber solicitações.'} /> :
          <div className="space-y-2">{offers.slice(0, 3).map(o => <div key={o.id} className="rounded-2xl border border-line p-3">
            <p className="text-xs font-extrabold">{o.establishment_name}</p><p className="text-[11px] text-ink/50">Retirada: {o.pickup_street}, {o.pickup_number} · {o.pickup_neighborhood}</p>
            <div className="mt-2 flex items-center justify-between"><b className="text-sm text-coral">{brl(o.fee_cents)}</b><Button size="sm" onClick={() => accept(o.id)}>Aceitar</Button></div></div>)}</div>}
      </Card>
      <Card className="p-5"><div className="mb-4 flex items-center justify-between"><h2 className="text-base font-extrabold">Entregas ativas</h2><Link to="/courier/entregas" className="text-xs font-bold text-coral">Ver todas →</Link></div>
        {active.length === 0 ? <EmptyState title="Sem entregas ativas" text="Aceite uma solicitação para começar." /> : <div className="space-y-2">{active.map(d => <Link key={d.id} to="/courier/entregas" className="block rounded-2xl border border-line p-3 hover:border-coral">
          <div className="flex justify-between"><b className="text-xs">#{d.id.slice(-6).toUpperCase()}</b><Badge tone="blue">{d.status.replaceAll('_',' ')}</Badge></div>
          <p className="mt-1 text-[11px] text-ink/50">{d.establishment_name} · {dt(d.created_at)}</p></Link>)}</div>}
      </Card>
    </div>
  </DashShell>;
}
