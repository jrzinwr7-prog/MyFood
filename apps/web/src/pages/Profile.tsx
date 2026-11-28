import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Bike, Download, Heart, MapPin, Package, ShieldCheck, Store, Trash2, User, X } from 'lucide-react';
import { api } from '../lib/api';
import { brl, cepMask } from '../lib/format';
import { useApp } from '../state/AppContext';
import { ConsumerShell } from '../components/Layout';
import { Badge, Button, Card, Input, Modal, Select, Textarea } from '../components/ui';

export default function Profile() {
  const { user, logout, refreshUser, toast } = useApp();
  const nav = useNavigate();
  const [addresses, setAddresses] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') === 'ajuda' ? 'ajuda' : 'dados');
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(''); const [phone, setPhone] = useState('');
  const [newAddr, setNewAddr] = useState(false);
  const [form, setForm] = useState({ label: 'Casa', cep: '', street: '', number: '', complement: '', neighborhood: '', city: 'Lapão', state: 'BA' });
  const [support, setSupport] = useState({ subject: '', body: '' });
  const [deleteReason, setDeleteReason] = useState(''); const [deleteOpen, setDeleteOpen] = useState(false);

  const load = () => {
    if (!user) return;
    api.get('/addresses').then(r => setAddresses(r.items)).catch(() => {});
    api.get('/orders/meta/favorites').then(r => setFavorites(r.items)).catch(() => {});
    api.get('/orders/mine').then(r => setOrders(r.items)).catch(() => {});
    setName(user.name); setPhone(user.phone);
  };
  useEffect(load, [user?.id]);

  if (!user) return <ConsumerShell><div className="rounded-3xl bg-white p-8 text-center"><h1 className="text-xl font-extrabold">Entre na sua conta</h1>
    <Link to="/entrar"><Button className="mt-4">Entrar ou cadastrar</Button></Link></div></ConsumerShell>;

  async function saveProfile() {
    try { await api.patch('/auth/me', { name, phone }); await refreshUser(); setEdit(false); toast('Dados atualizados'); }
    catch (e: any) { toast(e.message, 'error'); }
  }
  async function cepLookup() {
    const d = form.cep.replace(/\D/g, ''); if (d.length !== 8) return;
    try { const r = await api.get(`/catalog/cep/${d}`); setForm(f => ({ ...f, ...r, street: r.street || f.street, city: r.city, state: r.state, neighborhood: r.neighborhood })); }
    catch (e: any) { toast(e.message, 'error'); }
  }
  async function addAddr() {
    try { await api.post('/addresses', { ...form, latitude: null, longitude: null, isDefault: addresses.length === 0 }); setNewAddr(false); load(); toast('Endereço salvo'); }
    catch (e: any) { toast(e.message, 'error'); }
  }
  async function removeAddr(id: string) { try { await api.del(`/addresses/${id}`); load(); toast('Endereço removido', 'info'); } catch (e: any) { toast(e.message, 'error'); } }
  async function exportData() {
    try { const r = await api.get('/auth/lgpd/export'); const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'meus-dados-myfood.json'; a.click(); URL.revokeObjectURL(a.href);
      toast('Exportação concluída'); } catch (e: any) { toast(e.message, 'error'); }
  }
  async function requestDelete() {
    try { await api.post('/auth/lgpd/delete-request', { reason: deleteReason }); setDeleteOpen(false); toast('Solicitação registrada'); } catch (e: any) { toast(e.message, 'error'); }
  }
  async function sendSupport() {
    try { await api.post('/chat/support', support); setSupport({ subject: '', body: '' }); toast('Chamado enviado para análise.'); }
    catch (e: any) { toast(e.message, 'error'); }
  }

  return <ConsumerShell>
    <div className="mb-6 flex items-center gap-4">
      <span className="grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-coral to-tangerine text-xl font-black text-white">{user.name.slice(0, 2).toUpperCase()}</span>
      <div><h1 className="text-2xl font-black">{user.name}</h1><p className="text-xs text-ink/50">{user.email} · {user.phone}</p><div className="mt-1.5 flex gap-2"><Badge tone="blue">{user.role === 'consumer' ? 'Consumidor' : user.role}</Badge><Badge tone={user.status === 'active' ? 'green' : 'red'}>{user.status === 'active' ? 'Conta ativa' : 'Suspensa'}</Badge></div></div>
    </div>
    <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto">
      {[['dados','Meus dados',User],['enderecos','Endereços',MapPin],['favoritos','Favoritos',Heart],['ajuda','Ajuda e LGPD',ShieldCheck]].map(([k,label,Icon]: any) =>
        <button key={k} onClick={() => setTab(k)} className={`flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold ${tab === k ? 'bg-ink text-white' : 'bg-white text-ink/55'}`}><Icon size={15} />{label}</button>)}
    </div>

    {tab === 'dados' && <div className="grid gap-4 md:grid-cols-2">
      <Card className="p-5"><div className="mb-4 flex items-center justify-between"><h2 className="text-base font-extrabold">Dados pessoais</h2><button onClick={() => setEdit(!edit)} className="text-xs font-bold text-coral">{edit ? 'Cancelar' : 'Editar'}</button></div>
        {edit ? <div className="space-y-3"><Input label="Nome" value={name} onChange={e => setName(e.target.value)} /><Input label="Telefone" value={phone} onChange={e => setPhone(e.target.value)} />
          <Button onClick={saveProfile}>Salvar alterações</Button></div> : <dl className="space-y-3 text-sm"><div><dt className="text-xs text-ink/45">Nome</dt><dd className="font-bold">{user.name}</dd></div>
          <div><dt className="text-xs text-ink/45">E-mail</dt><dd className="font-bold">{user.email}</dd></div>
          <div><dt className="text-xs text-ink/45">Telefone</dt><dd className="font-bold">{user.phone}</dd></div></dl>}
      </Card>
      <Card className="p-5"><h2 className="mb-4 text-base font-extrabold">Minha atividade</h2>
        <div className="space-y-2">{[
          ['/pedidos', 'Histórico de pedidos', Package, orders.length], ['/conversas', 'Mensagens', User, null],
          ['/merchant/cadastro', 'Quero vender no Fast Entregas', Store, null], ['/courier/cadastro', 'Quero ser entregador', Bike, null],
        ].map(([to, label, Icon, n]: any) => <Link key={label} to={to} className="flex items-center gap-3 rounded-2xl bg-mist p-3 text-xs font-bold hover:bg-line">
          <Icon size={17} className="text-coral" />{label}{n !== null && <Badge>{n}</Badge>}<ArrowRight size={15} className="ml-auto" /></Link>)}</div>
        <Button variant="outline" className="mt-4 w-full" onClick={() => { logout(); nav('/'); }}>Sair da conta</Button>
      </Card>
    </div>}

    {tab === 'enderecos' && <div>
      <div className="mb-4 flex justify-between"><h2 className="text-base font-extrabold">Endereços salvos</h2><Button size="sm" onClick={() => setNewAddr(true)}>Adicionar endereço</Button></div>
      {addresses.length === 0 ? <p className="rounded-2xl bg-white p-6 text-center text-sm text-ink/50">Nenhum endereço salvo.</p> : <div className="grid gap-3 md:grid-cols-2">{addresses.map(a => <Card key={a.id} className="flex items-start gap-3 p-4">
        <MapPin className="shrink-0 text-coral" size={18} /><div className="flex-1 text-xs"><b className="block text-sm">{a.label} {a.is_default && <Badge tone="green">Padrão</Badge>}</b>
          <p className="mt-1 text-ink/55">{a.street}, {a.number}{a.complement ? `, ${a.complement}` : ''} · {a.neighborhood}, {a.city}/{a.state}</p><p className="mt-1 text-ink/40">CEP {a.cep}</p></div>
        <button onClick={() => removeAddr(a.id)} className="text-ink/30 hover:text-red-500"><Trash2 size={16} /></button></Card>)}</div>}
    </div>}

    {tab === 'favoritos' && <div>{favorites.length === 0 ? <p className="rounded-2xl bg-white p-6 text-center text-sm text-ink/50">Você ainda não tem favoritos. Toque no coração de uma loja para salvar aqui.</p> :
      <div className="grid gap-3 md:grid-cols-3">{favorites.map(e => <Link key={e.id} to={`/loja/${e.slug}`} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-coral/10 text-coral">{e.name[0]}</span><span className="text-sm font-bold">{e.name}</span></Link>)}</div>}</div>}

    {tab === 'ajuda' && <div className="grid gap-4 md:grid-cols-2">
      <Card className="p-5"><h2 className="mb-3 text-base font-extrabold">Suporte e denúncias</h2>
        <div className="space-y-3"><Input label="Assunto" value={support.subject} onChange={e => setSupport({ ...support, subject: e.target.value })} placeholder="Ex.: Problema com pedido" />
          <Textarea label="Descreva o ocorrido" rows={4} value={support.body} onChange={e => setSupport({ ...support, body: e.target.value })} />
          <Button onClick={sendSupport}>Enviar chamado</Button></div>
      </Card>
      <Card className="p-5"><h2 className="mb-3 text-base font-extrabold">Privacidade (LGPD)</h2>
        <p className="mb-4 text-xs text-ink/55">Você pode exportar seus dados ou solicitar a exclusão. A exclusão é analisada pelo controlador e registrada em auditoria.</p>
        <div className="space-y-2"><Button variant="outline" className="w-full" onClick={exportData}><Download size={16} />Exportar meus dados</Button>
          <Button variant="danger" className="w-full" onClick={() => setDeleteOpen(true)}><Trash2 size={16} />Solicitar exclusão</Button>
          <Link to="/privacidade" className="block pt-2 text-xs font-bold text-coral underline">Política de privacidade</Link></div>
      </Card>
    </div>}

    <Modal open={newAddr} onClose={() => setNewAddr(false)} title="Novo endereço">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Identificação" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} />
        <Input label="CEP" value={form.cep} onChange={e => setForm({ ...form, cep: cepMask(e.target.value) })} onBlur={cepLookup} />
        <div className="sm:col-span-2"><Input label="Rua / Avenida" value={form.street} onChange={e => setForm({ ...form, street: e.target.value })} /></div>
        <Input label="Número" value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} />
        <Input label="Complemento" value={form.complement} onChange={e => setForm({ ...form, complement: e.target.value })} />
        <Input label="Bairro" value={form.neighborhood} onChange={e => setForm({ ...form, neighborhood: e.target.value })} />
        <Input label="Cidade" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
        <Select label="UF" value={form.state} onChange={e => setForm({ ...form, state: e.target.value })}>{['BA','SP','RJ','MG'].map(s => <option key={s}>{s}</option>)}</Select>
      </div><Button className="mt-4 w-full" onClick={addAddr}>Salvar endereço</Button>
    </Modal>
    <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Solicitar exclusão de dados">
      <Textarea label="Motivo" rows={3} value={deleteReason} onChange={e => setDeleteReason(e.target.value)} />
      <Button variant="danger" className="mt-4 w-full" onClick={requestDelete}>Enviar solicitação</Button>
    </Modal>
  </ConsumerShell>;
}
