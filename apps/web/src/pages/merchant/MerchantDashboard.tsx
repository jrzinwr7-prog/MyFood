import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Bike, CheckCircle2, ClipboardList, DollarSign, Star, Store, TrendingUp } from 'lucide-react';
import { api } from '../../lib/api';
import { brl, dt } from '../../lib/format';
import { DashShell } from '../../components/Layout';
import { Badge, Button, Card, EmptyState, Spinner, StatCard } from '../../components/ui';

export default function MerchantDashboard() {
  const [data, setData] = useState<any>(null); const [me, setMe] = useState<any>(null); const [orders, setOrders] = useState<any[]>([]);
  useEffect(() => {
    api.get('/merchant/dashboard').then(setData).catch(() => {});
    api.get('/merchant/me').then(r => setMe(r.establishment)).catch(() => {});
    api.get('/merchant/orders').then(r => setOrders(r.items.filter((o: any) => !['delivered','cancelled'].includes(o.status)).slice(0, 5))).catch(() => {});
  }, []);
  return <DashShell role="merchant" title="Visão geral da loja">
    {!data ? <Spinner /> : <>
      {me?.status === 'pending' && <div className="mb-5 flex items-start gap-3 rounded-3xl border border-orange-200 bg-orange-50 p-5">
        <AlertCircle className="shrink-0 text-orange-600" size={22} /><div><h3 className="text-sm font-extrabold text-orange-800">Cadastro em análise</h3>
          <p className="mt-1 text-xs text-orange-700">Seu estabelecimento será publicado após a aprovação da administradora.</p></div></div>}
      {me?.status === 'rejected' && <div className="mb-5 rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"><b>Cadastro recusado:</b> {me.rejection_reason ?? 'Entre em contato com o suporte.'}</div>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pedidos recebidos" value={String(data.orders.received)} hint="Todo o histórico" icon={<ClipboardList size={19} />} />
        <StatCard label="Em andamento" value={String(data.orders.active)} hint="Requerem atenção" icon={<Bike size={19} />} tone="orange" />
        <StatCard label="Concluídos" value={String(data.orders.completed)} hint="Entregues com sucesso" icon={<CheckCircle2 size={19} />} tone="mint" />
        <StatCard label="Recebível acumulado" value={brl(data.revenueCents)} hint="Líquido de comissões" icon={<DollarSign size={19} />} tone="blue" />
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-base font-extrabold">Pedidos ativos</h2><Link to="/merchant/pedidos" className="text-xs font-bold text-coral">Ver todos →</Link></div>
          {orders.length === 0 ? <EmptyState icon={<ClipboardList />} title="Tudo em dia!" text="Nenhum pedido em andamento no momento." /> :
            <div className="space-y-2">{orders.map(o => <Link key={o.id} to="/merchant/pedidos" className="flex items-center gap-3 rounded-2xl border border-line p-3 hover:border-coral">
              <div className="min-w-0 flex-1"><p className="text-xs font-extrabold">#{o.id.slice(-6).toUpperCase()} · {o.customer_name}</p><p className="text-[11px] text-ink/50">{dt(o.created_at)}</p></div>
              <Badge tone="blue">{o.status.replaceAll('_',' ')}</Badge><b className="text-xs">{brl(o.total_cents)}</b></Link>)}</div>}
        </Card>
        <div className="space-y-5">
          <Card className="p-5"><h2 className="mb-4 text-base font-extrabold">Vendas de hoje</h2>
            <p className="text-3xl font-black">{brl(data.orders.today.sum)}</p><p className="mt-1 text-xs text-ink/50">{data.orders.today.n} pedido(s) hoje</p>
            <div className="mt-4 flex items-center gap-2 text-xs font-bold text-mint"><TrendingUp size={15} />Acompanhe seu crescimento pelo painel</div></Card>
          <Card className="p-5"><h2 className="mb-4 text-base font-extrabold">Mais vendidos</h2>
            {data.topProducts.length === 0 ? <p className="text-xs text-ink/50">Nenhuma venda registrada ainda.</p> : <div className="space-y-2">{data.topProducts.map((p: any) => <div key={p.name} className="flex justify-between text-xs"><span className="truncate text-ink/60">{p.name}</span><b>{p.qty}×</b></div>)}</div>}
            <div className="mt-4 flex items-center gap-2 text-xs"><Star size={15} className="text-tangerine" />Avaliação média: <b>{Number(data.avgRating).toFixed(1)}</b></div></Card>
        </div>
      </div>
      {me?.status === 'pending' && <div className="mt-5"><Link to="/merchant/cardapio"><Button><Store size={16} />Começar a cadastrar o cardápio</Button></Link></div>}
    </>}
  </DashShell>;
}
