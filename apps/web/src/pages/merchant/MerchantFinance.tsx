import { useEffect, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, BadgeDollarSign, Receipt } from 'lucide-react';
import { api } from '../../lib/api';
import { brl, dt } from '../../lib/format';
import { DashShell } from '../../components/Layout';
import { Card, EmptyState, StatCard } from '../../components/ui';

export default function MerchantFinance() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { api.get('/merchant/finance').then(setData).catch(() => {}); }, []);
  const rows = data?.commissions ?? [];
  return <DashShell role="merchant" title="Financeiro da loja">
    <div className="grid gap-3 sm:grid-cols-3">
      <StatCard label="Vendas elegíveis" value={brl(data?.totals?.gross ?? 0)} hint="Base de cálculo das comissões" icon={<Receipt size={19} />} />
      <StatCard label="Comissão da plataforma" value={brl(data?.totals?.commission ?? 0)} hint="8% configuráveis sobre produtos + entrega" icon={<ArrowDownRight size={19} />} tone="orange" />
      <StatCard label="A receber" value={brl(data?.totals?.receivable ?? 0)} hint="Repasses pendentes" icon={<BadgeDollarSign size={19} />} tone="mint" />
    </div>
    <Card className="mt-5 overflow-hidden">
      <div className="border-b border-line p-5"><h2 className="text-base font-extrabold">Histórico de comissões por pedido</h2><p className="mt-1 text-xs text-ink/50">Cada pedido gera um único lançamento, auditável e não duplicado.</p></div>
      {!data || rows.length === 0 ? <div className="p-5"><EmptyState title="Sem movimentação ainda" text="As comissões aparecerão quando os pedidos forem entregues e pagos." /></div> :
        <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-mist text-ink/50"><tr><th className="p-3">Pedido</th><th className="p-3">Data</th><th className="p-3">Base produtos</th><th className="p-3">Comissão produtos</th><th className="p-3">Comissão entrega</th><th className="p-3">Receita plataforma</th><th className="p-3">Seu líquido</th></tr></thead>
          <tbody>{rows.map((c: any) => <tr key={c.id} className="border-t border-line"><td className="p-3 font-bold">#{c.order_id?.slice(-6).toUpperCase()}</td><td className="p-3">{dt(c.created_at)}</td><td className="p-3">{brl(c.product_base_cents)}</td>
            <td className="p-3">{brl(c.product_commission_cents)}</td><td className="p-3">{brl(c.delivery_commission_cents)}</td><td className="p-3">{brl(c.platform_revenue_cents)}</td><td className="p-3 font-black text-mint">{brl(c.merchant_payout_cents)}</td></tr>)}</tbody></table></div>}
    </Card>
    {data?.refunds?.length > 0 && <Card className="mt-5 p-5"><h2 className="mb-3 text-base font-extrabold">Estornos</h2>
      {data.refunds.map((r: any) => <div key={r.id} className="flex justify-between border-b border-line py-2 text-xs"><span>{r.reason}</span><b className="flex items-center gap-1 text-red-600"><ArrowUpRight size={13} />{brl(r.amount_cents)}</b></div>)}</Card>}
  </DashShell>;
}
