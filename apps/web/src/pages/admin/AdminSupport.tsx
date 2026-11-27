import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { dt } from '../../lib/format';
import { useApp } from '../../state/AppContext';
import { DashShell } from '../../components/Layout';
import { Badge, Button, Card, Spinner, Textarea } from '../../components/ui';

export default function AdminSupport() {
  const { toast } = useApp(); const [items, setItems] = useState<any[] | null>(null);
  const load = () => api.get('/chat/support').then(r => setItems(r.items)).catch(() => setItems([]));
  useEffect(() => { load(); }, []);
  async function answer(t: any, status: string) { try { await api.patch(`/chat/support/${t.id}`, { status, response: 'Resposta registrada pela administração.' }); toast('Chamado atualizado'); load(); } catch (e: any) { toast(e.message, 'error'); } }
  return <DashShell role="admin" title="Suporte e denúncias">
    {items === null ? <Spinner /> : items.length === 0 ? <p className="rounded-3xl bg-white p-8 text-center text-sm text-ink/50">Nenhum chamado aberto.</p> :
      <div className="space-y-3">{items.map(t => <Card key={t.id} className="p-5">
        <div className="flex justify-between"><div><b className="text-sm">{t.subject}</b><p className="text-[11px] text-ink/45">{dt(t.created_at)}</p></div><Badge tone={t.status === 'closed' ? 'green' : 'orange'}>{t.status}</Badge></div>
        <p className="mt-3 text-xs text-ink/60">{t.body}</p>
        {t.status !== 'closed' && <div className="mt-3 flex gap-2"><Button size="sm" onClick={() => answer(t, 'answered')}>Responder</Button><Button size="sm" variant="outline" onClick={() => answer(t, 'closed')}>Encerrar</Button></div>}
      </Card>)}</div>}
  </DashShell>;
}
