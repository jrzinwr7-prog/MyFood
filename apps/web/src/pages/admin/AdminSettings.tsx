import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useApp } from '../../state/AppContext';
import { DashShell } from '../../components/Layout';
import { Badge, Button, Card, Input, Select } from '../../components/ui';

export default function AdminSettings() {
  const { toast } = useApp(); const [s, setS] = useState<any>(null); const [cats, setCats] = useState<any[]>([]);
  const [newCat, setNewCat] = useState(''); const [banner, setBanner] = useState({ title: '', subtitle: '', imageUrl: '/hero-burger.jpg' });
  const load = () => {
    api.get('/admin/settings').then(r => setS(r.settings)).catch(() => setS({}));
    api.get('/admin/categories').then(r => setCats(r.items)).catch(() => {});
  };
  useEffect(() => { load(); }, []);
  async function save() {
    try { await api.patch('/admin/settings', { commissions: s.commissions, city: s.city, states: s.states,
      banners: s.banners ?? [], featured: s.featured ?? {}, deliveryRules: s.deliveryRules, cashEnabled: s.cashEnabled });
      toast('Configurações salvas e auditadas'); load(); } catch (e: any) { toast(e.message, 'error'); }
  }
  async function addCategory() {
    if (!newCat.trim()) return;
    try { await api.post('/admin/categories', { name: newCat, icon: 'utensils' }); setNewCat(''); load(); toast('Categoria criada'); } catch (e: any) { toast(e.message, 'error'); }
  }
  async function toggleCategory(c: any) { try { await api.patch(`/admin/categories/${c.id}`, { active: !c.active }); load(); } catch (e: any) { toast(e.message, 'error'); } }
  async function addBanner() { if (!banner.title) return; try { await api.patch('/admin/settings', { banners: [...(s.banners ?? []), banner] }); setBanner({ ...banner, title: '', subtitle: '' }); load(); toast('Banner adicionado'); } catch (e: any) { toast(e.message, 'error'); } }
  if (!s) return <DashShell role="admin" title="Configurações"><p className="text-sm">Carregando…</p></DashShell>;
  return <DashShell role="admin" title="Configurações administrativas">
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="p-5"><h2 className="mb-4 text-base font-extrabold">Comissões e regras</h2>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Comissão produtos (%)" type="number" value={(s.commissions?.productsBps ?? 800) / 100} onChange={e => setS({ ...s, commissions: { ...s.commissions, productsBps: Math.round(Number(e.target.value) * 100) } })} />
          <Input label="Comissão entregas (%)" type="number" value={(s.commissions?.deliveryBps ?? 800) / 100} onChange={e => setS({ ...s, commissions: { ...s.commissions, deliveryBps: Math.round(Number(e.target.value) * 100) } })} />
          <Input label="Cidade principal" value={s.city ?? ''} onChange={e => setS({ ...s, city: e.target.value })} />
          <Input label="Estados (separados por vírgula)" value={(s.states ?? ['BA']).join(',')} onChange={e => setS({ ...s, states: e.target.value.split(',').map((x: string) => x.trim().toUpperCase()).filter(Boolean) })} />
          <Input label="Raio máximo de entrega (km)" type="number" value={s.deliveryRules?.maxRadiusKm ?? 15} onChange={e => setS({ ...s, deliveryRules: { ...(s.deliveryRules ?? {}), maxRadiusKm: Number(e.target.value), baseFeeCents: s.deliveryRules?.baseFeeCents ?? 0 } })} />
          <Select label="Dinheiro na entrega" value={s.cashEnabled === false ? 'no' : 'yes'} onChange={e => setS({ ...s, cashEnabled: e.target.value === 'yes' })}><option value="yes">Habilitado</option><option value="no">Desabilitado</option></Select>
        </div>
        <Button className="mt-4" onClick={save}>Salvar configurações</Button>
        <p className="mt-3 text-[11px] text-ink/45">Todas as alterações financeiras geram registro em log de auditoria.</p>
      </Card>
      <Card className="p-5"><h2 className="mb-4 text-base font-extrabold">Categorias administráveis</h2>
        <div className="flex gap-2"><Input placeholder="Nova categoria" value={newCat} onChange={e => setNewCat(e.target.value)} /><Button onClick={addCategory}><Plus size={15} />Adicionar</Button></div>
        <div className="mt-4 flex flex-wrap gap-2">{cats.map(c => <button key={c.id} onClick={() => toggleCategory(c)} className="flex items-center gap-1"><Badge tone={c.active ? 'green' : 'neutral'}>{c.name}</Badge></button>)}</div>
      </Card>
      <Card className="p-5"><h2 className="mb-4 text-base font-extrabold">Banners da página inicial</h2>
        <div className="space-y-2"><Input placeholder="Título" value={banner.title} onChange={e => setBanner({ ...banner, title: e.target.value })} />
          <Input placeholder="Subtítulo" value={banner.subtitle} onChange={e => setBanner({ ...banner, subtitle: e.target.value })} />
          <Input placeholder="URL da imagem" value={banner.imageUrl} onChange={e => setBanner({ ...banner, imageUrl: e.target.value })} /></div>
        <Button className="mt-3" onClick={addBanner}>Adicionar banner</Button>
        <div className="mt-4 space-y-2">{(s.banners ?? []).map((b: any, i: number) => <div key={i} className="flex items-center justify-between rounded-xl bg-mist p-3 text-xs"><span><b>{b.title}</b> · {b.subtitle}</span>
          <button onClick={() => { api.patch('/admin/settings', { banners: s.banners.filter((_: any, k: number) => k !== i) }); load(); }} className="text-red-500"><Trash2 size={15} /></button></div>)}</div>
      </Card>
      <Card className="p-5"><h2 className="mb-4 text-base font-extrabold">Lojas em destaque</h2>
        {cats.length > 0 && <p className="text-xs text-ink/50">O destaque é configurado por estabelecimento na lista de estabelecimentos (ação “Destacar”). Banners e categorias acima já afetam o aplicativo.</p>}
      </Card>
    </div>
  </DashShell>;
}
