import { useEffect, useState } from 'react';
import { Pause, Pencil, Plus, Trash2, Utensils } from 'lucide-react';
import { api } from '../../lib/api';
import { brl } from '../../lib/format';
import { useApp } from '../../state/AppContext';
import { DashShell } from '../../components/Layout';
import { Badge, Button, Card, EmptyState, Input, Modal, Spinner, Textarea } from '../../components/ui';

const empty: any = { name: '', description: '', priceCents: 0, imageUrl: '', categoryId: '', available: true, sortOrder: 0, prepMinutes: 0, groups: [] };

export default function MerchantMenu() {
  const { toast } = useApp();
  const [items, setItems] = useState<any[] | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const load = () => api.get('/products').then(r => setItems(r.items)).catch(() => setItems([]));
  useEffect(() => { load(); }, []);
  function addGroup() { setEditing((e: any) => ({ ...e, groups: [...(e.groups ?? []), { name: '', minSelected: 0, maxSelected: 1, options: [] }] })); }
  function updateGroup(i: number, patch: any) { setEditing((e: any) => ({ ...e, groups: e.groups.map((g: any, k: number) => k === i ? { ...g, ...patch } : g) })); }
  function addOption(gi: number) { updateGroup(gi, { options: [...editing.groups[gi].options, { name: '', priceCents: 0, available: true }] }); }

  async function save() {
    try {
      const payload = { ...editing, priceCents: Number(editing.priceCents), prepMinutes: Number(editing.prepMinutes),
        categoryId: editing.categoryId || null, imageUrl: editing.imageUrl || null,
        groups: editing.groups.filter((g: any) => g.name.trim()).map((g: any) => ({ ...g,
          options: g.options.filter((o: any) => o.name.trim()).map((o: any) => ({ ...o, priceCents: Number(o.priceCents) })) })) };
      if (editing.id) await api.patch(`/products/${editing.id}`, payload);
      else await api.post('/products', payload);
      setOpen(false); setEditing(null); load(); toast('Cardápio atualizado — mudanças já visíveis no aplicativo');
    } catch (e: any) { toast(e.message, 'error'); }
  }
  async function toggle(p: any) { try { await api.patch(`/products/${p.id}/availability`, { available: !p.available }); load(); } catch (e: any) { toast(e.message, 'error'); } }
  async function remove(p: any) { if (!confirm(`Excluir "${p.name}"?`)) return; try { await api.del(`/products/${p.id}`); load(); toast('Produto excluído', 'info'); } catch (e: any) { toast(e.message, 'error'); } }

  return <DashShell role="merchant" title="Gerenciamento do cardápio">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-base font-extrabold">Seus produtos</h2><p className="text-xs text-ink/50">Alterações refletem imediatamente no aplicativo.</p></div>
      <Button onClick={() => { setEditing({ ...empty, groups: [] }); setOpen(true); }}><Plus size={16} />Novo produto</Button>
    </div>
    {items === null ? <Spinner /> : items.length === 0 ? <EmptyState icon={<Utensils />} title="Cardápio vazio" text="Cadaste seu primeiro produto para começar a receber pedidos."
      action={<Button onClick={() => { setEditing({ ...empty, groups: [] }); setOpen(true); }}>Cadastrar produto</Button>} /> :
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{items.map(p => <Card key={p.id} className="overflow-hidden">
        <div className="flex gap-3 p-4">
          <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-cream text-2xl">{p.imageUrl ? <img src={p.imageUrl} className="h-full w-full object-cover" alt="" /> : '🍽️'}</div>
          <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="text-sm font-extrabold">{p.name}</p><Badge tone={p.available ? 'green' : 'red'}>{p.available ? 'Ativo' : 'Pausado'}</Badge></div>
            <p className="mt-1 line-clamp-2 text-[11px] text-ink/50">{p.description || 'Sem descrição'}</p>
            <p className="mt-2 text-sm font-black text-coral">{brl(p.priceCents)}</p></div>
        </div>
        <div className="flex items-center gap-1 border-t border-line px-4 py-2.5">
          <button onClick={() => toggle(p)} className="flex items-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-bold text-ink/50 hover:bg-mist"><Pause size={13} />{p.available ? 'Pausar' : 'Ativar'}</button>
          <button onClick={() => { setEditing(p); setOpen(true); }} className="flex items-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-bold text-ink/50 hover:bg-mist"><Pencil size={13} />Editar</button>
          <button onClick={() => remove(p)} className="ml-auto rounded-xl p-1.5 text-ink/30 hover:bg-red-50 hover:text-red-500"><Trash2 size={15} /></button>
        </div>
      </Card>)}</div>}

    <Modal open={open} onClose={() => setOpen(false)} title={editing?.id ? 'Editar produto' : 'Novo produto'} wide>
      {editing && <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Nome do produto" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
          <Input label="Preço (R$)" type="number" step="0.01" min="0" value={(editing.priceCents / 100).toFixed(2)} onChange={e => setEditing({ ...editing, priceCents: Math.round(Number(e.target.value) * 100) })} />
        </div>
        <Textarea label="Descrição" rows={2} value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} />
        <Input label="URL da imagem" value={editing.imageUrl ?? ''} onChange={e => setEditing({ ...editing, imageUrl: e.target.value })} placeholder="https://…" hint="Use uma URL pública hospedada em storage/CDN." />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Tempo de preparo (min)" type="number" value={editing.prepMinutes} onChange={e => setEditing({ ...editing, prepMinutes: Number(e.target.value) })} />
          <label className="flex items-end gap-2 pb-3 text-xs font-bold"><input type="checkbox" checked={editing.available} onChange={e => setEditing({ ...editing, available: e.target.checked })} className="accent-coral" />Disponível</label>
        </div>
        <div className="flex items-center justify-between border-t border-line pt-4"><h3 className="text-sm font-extrabold">Grupos de opções e adicionais</h3><Button size="sm" variant="outline" onClick={addGroup}><Plus size={14} />Adicionar grupo</Button></div>
        {(editing.groups ?? []).map((g: any, gi: number) => <div key={gi} className="rounded-2xl border border-line p-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Input label="Nome do grupo" value={g.name} onChange={e => updateGroup(gi, { name: e.target.value })} />
            <Input label="Mínimo" type="number" value={g.minSelected} onChange={e => updateGroup(gi, { minSelected: Number(e.target.value) })} />
            <Input label="Máximo" type="number" value={g.maxSelected} onChange={e => updateGroup(gi, { maxSelected: Number(e.target.value) })} />
            <div className="flex items-end gap-2"><Button size="sm" variant="ghost" onClick={() => setEditing({ ...editing, groups: editing.groups.filter((_: any, k: number) => k !== gi) })}><Trash2 size={14} /></Button></div>
          </div>
          <div className="mt-3 space-y-2">{g.options.map((o: any, oi: number) => <div key={oi} className="flex gap-2">
            <Input placeholder="Nome do adicional" value={o.name} onChange={e => { const opts = [...g.options]; opts[oi] = { ...o, name: e.target.value }; updateGroup(gi, { options: opts }); }} />
            <Input placeholder="Preço" type="number" step="0.01" value={(o.priceCents / 100).toFixed(2)} onChange={e => { const opts = [...g.options]; opts[oi] = { ...o, priceCents: Math.round(Number(e.target.value) * 100) }; updateGroup(gi, { options: opts }); }} />
            <button onClick={() => updateGroup(gi, { options: g.options.filter((_: any, k: number) => k !== oi) })} className="text-ink/30 hover:text-red-500"><Trash2 size={16} /></button>
          </div>)}</div>
          <button onClick={() => addOption(gi)} className="mt-2 text-xs font-bold text-coral">+ Adicionar opção</button>
        </div>)}
        <Button className="w-full" onClick={save}>Salvar produto</Button>
      </div>}
    </Modal>
  </DashShell>;
}
