import { useEffect, useState } from 'react';
import { Activity, Bike, CircleDollarSign, ClipboardList, Store, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { brl } from '../../lib/format';
import { DashShell } from '../../components/Layout';
import { Badge, Card, Spinner, StatCard } from '../../components/ui';

export default function AdminDashboard() {
  const [d, setD] = useState<any>(null);
  useEffect(() => { api.get('/admin/dashboard').then(setD).catch(() => {}); }, []);
  if (!d) return <DashShell role="admin" title="Dashboard"><Spinner /></DashShell>;
  const max = Math.max(...d.growth.map((g: any) => g.orders), 1);
  return <DashShell role="admin" title="Dashboard da plataforma">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Consumidores" value={String(d.users.consumers)} icon={<Users size={19} />} />
      <StatCard label="Estabelecimentos" value={String(d.users.merchants)} hint={`${d.users.pendingMerchants} aguardando`} icon={<Store size={19} />} tone="blue" />
      <StatCard label="Entregadores" value={String(d.users.couriers)} hint={`${d.users.pendingCouriers} aguardando`} icon={<Bike size={19} />} tone="orange" />
      <StatCard label="Volume movimentado" value={brl(d.orders.gmvCents)} icon={<CircleDollarSign size={19} />} tone="mint" />
    </div>
    <div className="mt-3 grid gap-3 sm:grid-cols-3">
      <StatCard label="Pedidos realizados" value={String(d.orders.total)} icon={<ClipboardList size={19} />} />
      <StatCard label="Em andamento" value={String(d.orders.active)} icon={<Activity size={19} />} tone="orange" />
      <StatCard label="Comissões arrecadadas" value={brl(d.orders.commissionCents)} hint="8% produtos + 8% entrega" icon={<CircleDollarSign size={19} />} tone="mint" />
    </div>
    <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <Card className="p-5"><h2 className="mb-5 text-base font-extrabold">Pedidos por dia (últimos 30)</h2>
        <div className="flex h-40 items-end gap-1.5">{d.growth.slice(0, 30).reverse().map((g: any) => <div key={g.day} className="group flex flex-1 flex-col items-center justify-end gap-1" title={`${g.day}: ${g.orders} pedidos`}>
          <div className="w-full rounded-t-md bg-gradient-to-t from-coral to-tangerine transition group-hover:opacity-80" style={{ height: `${Math.max(4, (g.orders / max) * 130)}px` }} /></div>)}</div>
        <div className="mt-2 flex justify-between text-[10px] text-ink/40"><span>{d.growth.at(-1)?.day ?? '—'}</span><span>hoje</span></div>
      </Card>
      <div className="space-y-5">
        <Card className="p-5"><h2 className="mb-3 text-base font-extrabold">Estabelecimentos mais movimentados</h2>
          {d.topEstablishments.length === 0 ? <p className="text-xs text-ink/50">Sem dados ainda.</p> : <div className="space-y-2">{d.topEstablishments.slice(0, 6).map((e: any) => <div key={e.name} className="flex justify-between text-xs"><span className="truncate text-ink/60">{e.name}</span><b>{e.orders} pedidos</b></div>)}</div>}
        </Card>
        <Card className="p-5"><h2 className="mb-3 text-base font-extrabold">Produtos mais vendidos</h2>
          {d.topProducts.length === 0 ? <p className="text-xs text-ink/50">Sem dados ainda.</p> : <div className="flex flex-wrap gap-2">{d.topProducts.slice(0, 8).map((p: any) => <Badge key={p.name}>{p.name} · {p.qty}×</Badge>)}</div>}
        </Card>
      </div>
    </div>
  </DashShell>;
}
