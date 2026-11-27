import { useEffect, useState } from 'react';
import { Banknote, CheckCircle2, Wallet } from 'lucide-react';
import { api } from '../../lib/api';
import { brl, dt } from '../../lib/format';
import { DashShell } from '../../components/Layout';
import { Card, EmptyState, StatCard } from '../../components/ui';

export default function CourierEarnings() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { api.get('/couriers/earnings').then(setData).catch(() => {}); }, []);
  return <DashShell role="courier" title="Ganhos e repasses">
    <div className="grid gap-3 sm:grid-cols-3">
      <StatCard label="Total de ganhos" value={brl(data?.totals?.earnings ?? 0)} hint="Repasses registrados no sistema" icon={<Wallet size={19} />} tone="mint" />
      <StatCard label="Entregas concluídas" value={String(data?.delivered ?? 0)} icon={<CheckCircle2 size={19} />} tone="blue" />
      <StatCard label="Repasses pendentes" value={String((data?.payouts ?? []).filter((p: any) => p.status === 'pending').length)} icon={<Banknote size={19} />} tone="orange" />
    </div>
    <Card className="mt-5 p-5"><h2 className="mb-4 text-base font-extrabold">Histórico de repasses</h2>
      {!data?.payouts?.length ? <EmptyState title="Sem repasses ainda" text="Seus ganhos aparecerão após a conclusão das entregas." /> :
        <div className="space-y-2">{data.payouts.map((p: any) => <div key={p.id} className="flex items-center justify-between rounded-2xl bg-mist p-3 text-xs">
          <div><b className="block">Pedido #{p.order_id?.slice(-6).toUpperCase()}</b><span className="text-ink/45">{dt(p.created_at)}</span></div>
          <div className="text-right"><b className="block text-mint">{brl(p.amount_cents)}</b><span className="text-[10px] uppercase text-ink/45">{p.status}</span></div>
        </div>)}</div>}
    </Card>
    <p className="mt-3 text-[11px] text-ink/45">A comissão da plataforma sobre a taxa de entrega é deduzida antes do repasse (8% por padrão, configurável).</p>
  </DashShell>;
}
