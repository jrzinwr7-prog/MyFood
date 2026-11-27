import { useEffect, useState } from 'react';
import { ShieldOff, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { useApp } from '../../state/AppContext';
import { DashShell } from '../../components/Layout';
import { Badge, Button, Card, EmptyState, Input, Spinner } from '../../components/ui';

export default function AdminUsers() {
  const { toast } = useApp(); const [items, setItems] = useState<any[] | null>(null); const [q, setQ] = useState('');
  const load = () => api.get(`/admin/users?role=consumer${q ? `&q=${encodeURIComponent(q)}` : ''}`).then(r => setItems(r.items)).catch(() => setItems([]));
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [q]);
  async function toggle(u: any) { try { await api.patch(`/admin/users/${u.id}`, { status: u.status === 'active' ? 'suspended' : 'active' }); toast('Status alterado'); load(); } catch (e: any) { toast(e.message, 'error'); } }
  return <DashShell role="admin" title="Consumidores e contas">
    <div className="mb-4 max-w-md"><Input placeholder="Buscar por nome ou e-mail" value={q} onChange={e => setQ(e.target.value)} /></div>
    {items === null ? <Spinner /> : items.length === 0 ? <EmptyState icon={<Users />} title="Nenhum consumidor encontrado" text="Ajuste a busca." /> :
      <div className="space-y-2">{items.map(u => <Card key={u.id} className="flex flex-wrap items-center gap-3 p-4">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink/5 text-xs font-black">{u.name.slice(0,2).toUpperCase()}</span>
        <div className="min-w-[180px] flex-1"><p className="text-sm font-bold">{u.name}</p><p className="text-[11px] text-ink/50">{u.email} · {u.phone}</p></div>
        <Badge tone={u.status === 'active' ? 'green' : 'red'}>{u.status}</Badge>
        <Button size="sm" variant={u.status === 'active' ? 'danger' : 'mint'} onClick={() => toggle(u)}><ShieldOff size={14} />{u.status === 'active' ? 'Suspender' : 'Reativar'}</Button>
      </Card>)}</div>}
  </DashShell>;
}
