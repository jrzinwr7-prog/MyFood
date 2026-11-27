import { useEffect, useState } from 'react';
import { BadgeDollarSign, CheckCircle2, RotateCcw } from 'lucide-react';
import { api } from '../../lib/api';
import { brl, dt } from '../../lib/format';
import { useApp } from '../../state/AppContext';
import { DashShell } from '../../components/Layout';
import { Button, Card, EmptyState, Input, Spinner, StatCard } from '../../components/ui';

export default function AdminFinance() {
  const { toast } = useApp(); const [d, setD] = useState<any>(null); const [external, setExternal] = useState<Record<string, string>>({});
  const load = () => api.get('/admin/finance').then(setD).catch(() => {});
  useEffect(() => { load(); }, []);
  async function paid(id: string) { try { await api.post(`/admin/payouts/${id}/paid`, { externalId: external[id] ?? `manual-${id}` }); toast('Repasse marcado como pago'); load(); } catch (e: any) { toast(e.message, 'error'); } }
  if (!d) return <DashShell role="admin" title="Financeiro"><Spinner /></DashShell>;
  return <DashShell role="admin" title="Controle financeiro">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Receita da plataforma" value={brl(d.totals.revenue)} hint="Comissões de produtos + entregas" icon={<BadgeDollarSign size={19} />} tone="mint" />
      <StatCard label="Comissão sobre produtos" value={brl(d.totals.product_commission)} icon={<CheckCircle2 size={19} />} />
      <StatCard label="Comissão sobre entregas" value={brl(d.totals.delivery_commission)} icon={<CheckCircle2 size={19} />} tone="blue" />
      <StatCard label="A repassar (lojas + entregadores)" value={brl(d.totals.merchant_due + d.totals.courier_due)} icon={<RotateCcw size={19} />} tone="orange" />
    </div>
    <Card className="mt-5 p-5"><h2 className="mb-4 text-base font-extrabold">Comissões por pedido (registro auditável, sem duplicidade)</h2>
      {d.commissions.length === 0 ? <EmptyState title="Sem comissões" text="Após a entrega de pedidos pagos, os lançamentos aparecem aqui." /> :
        <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-mist text-ink/50"><tr><th className="p-2">Pedido</th><th className="p-2">Base produtos</th><th className="p-2">Produtos 8%</th><th className="p-2">Entrega</th><th className="p-2">Entrega 8%</th><th className="p-2">Receita</th><th className="p-2">Entregador</th><th className="p-2">Loja</th></tr></thead>
          <tbody>{d.commissions.map((c: any) => <tr key={c.id} className="border-t border-line"><td className="p-2 font-bold">#{c.order_id.slice(-6).toUpperCase()}</td><td className="p-2">{brl(c.product_base_cents)}</td>
            <td className="p-2">{brl(c.product_commission_cents)}</td><td className="p-2">{brl(c.delivery_fee_cents)}</td><td className="p-2">{brl(c.delivery_commission_cents)}</td>
            <td className="p-2 font-black text-mint">{brl(c.platform_revenue_cents)}</td><td className="p-2">{brl(c.courier_payout_cents)}</td><td className="p-2">{brl(c.merchant_payout_cents)}</td></tr>)}</tbody></table></div>}
    </Card>
    <Card className="mt-5 p-5"><h2 className="mb-4 text-base font-extrabold">Repasses</h2>
      {d.payouts.length === 0 ? <p className="text-xs text-ink/50">Nenhum repasse registrado.</p> : <div className="space-y-2">{d.payouts.map((p: any) => <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-mist p-3 text-xs">
        <div className="flex-1"><b className="block">#{p.order_id.slice(-6).toUpperCase()} · {p.recipient_type}</b><span className="text-ink/45">{dt(p.created_at)} · {p.status}</span></div>
        <b>{brl(p.amount_cents)}</b>
        {p.status === 'pending' && <><Input placeholder="ID da transação" value={external[p.id] ?? ''} onChange={e => setExternal({ ...external, [p.id]: e.target.value })} className="w-40" />
          <Button size="sm" onClick={() => paid(p.id)}>Marcar pago</Button></>}
      </div>)}</div>}
    </Card>
    {d.refunds.length > 0 && <Card className="mt-5 p-5"><h2 className="mb-3 text-base font-extrabold">Estornos registrados</h2>
      {d.refunds.map((r: any) => <div key={r.id} className="flex justify-between border-b border-line py-2 text-xs"><span>{r.reason}</span><b className="text-red-600">{brl(r.amount_cents)}</b></div>)}</Card>}
  </DashShell>;
}
