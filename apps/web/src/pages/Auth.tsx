import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Bike, Check, ShieldCheck, Store, User } from 'lucide-react';
import { api, setToken } from '../lib/api';
import { cepMask } from '../lib/format';
import { useApp } from '../state/AppContext';
import { Button, Card, Input, Select } from '../components/ui';

export default function Auth() {
  const { login, register, toast } = useApp();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<'login' | 'register'>(params.get('mode') === 'register' ? 'register' : 'login');
  const [role, setRole] = useState<'consumer' | 'merchant' | 'courier'>((params.get('role') as any) || 'consumer');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [consent, setConsent] = useState(false);
  const [form, setForm] = useState<any>({ name: '', email: '', phone: '', password: '', document: '',
    storeName: '', categoryId: 'hamburgueres', storePhone: '', cep: '', street: '', number: '', complement: '', neighborhood: '', city: 'Lapão', state: 'BA',
    vehicle: 'motorcycle', vehiclePlate: '' });
  const [categories, setCategories] = useState<any[]>([]);
  useEffect(() => { api.get('/catalog/categories').then(r => setCategories(r.items)).catch(() => {}); }, []);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  async function lookupCep() {
    const d = (form.cep ?? '').replace(/\D/g, ''); if (d.length !== 8) return;
    try { const r = await api.get(`/catalog/cep/${d}`); setForm((f: any) => ({ ...f, ...r, street: r.street || f.street, city: r.city, state: r.state, neighborhood: r.neighborhood })); }
    catch (e: any) { toast(e.message, 'error'); }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      if (mode === 'login') {
        const r = await login(form.email, form.password);
        nav(r.user.role === 'merchant' ? '/merchant' : r.user.role === 'courier' ? '/courier' : r.user.role === 'admin' ? '/admin' : '/');
      } else {
        const body: any = { role, name: form.name, email: form.email, phone: form.phone, password: form.password, lgpdConsent: consent };
        if (role === 'merchant') body.establishment = { name: form.storeName, categoryId: form.categoryId, document: form.document,
          phone: form.storePhone || form.phone,
          address: { cep: form.cep, street: form.street, number: form.number, complement: form.complement, neighborhood: form.neighborhood, city: form.city, state: form.state } };
        if (role === 'courier') body.courier = { document: form.document, vehicle: form.vehicle, vehiclePlate: form.vehiclePlate };
        const r = await register(body);
        nav(role === 'merchant' ? '/merchant' : role === 'courier' ? '/courier' : '/');
        if (role !== 'consumer') toast('Cadastro enviado! Acompanhe a aprovação no painel.', 'info');
      }
    } catch (err: any) { setError(err.message ?? 'Erro ao processar'); setBusy(false); }
  }

  return <div className="min-h-screen bg-mist">
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <img src={`${import.meta.env.BASE_URL}hero-burger.jpg`} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/95 via-ink/60 to-ink" />
        <Link to="/" className="relative flex items-center gap-2.5 text-2xl font-black"><span className="grid h-10 w-10 place-items-center rounded-xl bg-coral text-white">m</span>My<span className="text-coral">Food</span></Link>
        <div className="relative max-w-md"><h1 className="text-4xl font-black leading-tight">Tudo que sua cidade tem de melhor, <span className="text-tangerine">em um só lugar.</span></h1>
          <p className="mt-4 text-white/70">Peça, venda ou entregue. A plataforma conecta consumidores, estabelecimentos e entregadores com transparência e tecnologia.</p>
          <div className="mt-8 space-y-3 text-sm">{[[User,'Consumidores','Descubra, peça e acompanhe'],[Store,'Estabelecimentos','Gerencie cardápio e pedidos'],[Bike,'Entregadores','Receba solicitações e ganhe']].map(([Icon, t, s]: any) =>
            <div key={t} className="flex items-center gap-3 rounded-2xl bg-white/10 p-3 backdrop-blur"><Icon size={20} className="text-tangerine" /><div><b className="block">{t}</b><span className="text-xs text-white/60">{s}</span></div></div>)}</div>
        </div>
        <p className="relative text-xs text-white/40">© {new Date().getFullYear()} MyFood · Feito no Brasil</p>
      </div>
      <div className="flex items-center justify-center p-4 py-10 sm:p-8">
        <div className="w-full max-w-lg">
          <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-xs font-bold text-ink/50"><ArrowLeft size={15} />Voltar ao início</Link>
          <Card className="p-6 sm:p-8">
            <div className="mb-6 flex rounded-2xl bg-mist p-1">
              <button onClick={() => setMode('login')} className={`flex-1 rounded-xl py-2.5 text-sm font-extrabold transition ${mode === 'login' ? 'bg-white shadow-card' : 'text-ink/50'}`}>Entrar</button>
              <button onClick={() => setMode('register')} className={`flex-1 rounded-xl py-2.5 text-sm font-extrabold transition ${mode === 'register' ? 'bg-white shadow-card' : 'text-ink/50'}`}>Criar conta</button>
            </div>
            {mode === 'register' && <div className="mb-5 grid grid-cols-3 gap-2">
              {([['consumer','Consumidor',User],['merchant','Estabelecimento',Store],['courier','Entregador',Bike]] as const).map(([r, label, Icon]) =>
                <button key={r} onClick={() => setRole(r)} className={`flex flex-col items-center gap-1 rounded-2xl border p-3 text-[10px] font-bold transition ${role === r ? 'border-coral bg-coral/5 text-coral' : 'border-line text-ink/50'}`}>
                  <Icon size={18} />{label}</button>)}
            </div>}
            <form onSubmit={submit} className="space-y-3">
              {mode === 'register' && <Input label="Nome completo" value={form.name} onChange={e => set('name', e.target.value)} required />}
              <Input label="E-mail" type="email" value={form.email} onChange={e => set('email', e.target.value)} required autoComplete="email" />
              <Input label="Senha" type="password" value={form.password} onChange={e => set('password', e.target.value)} required minLength={mode === 'register' ? 8 : 1} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} hint={mode === 'register' ? 'Mínimo de 8 caracteres' : undefined} />
              {mode === 'register' && <>
                <Input label="Celular / WhatsApp" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(74) 99999-0000" required />
                <Input label={role === 'courier' ? 'CPF' : role === 'merchant' ? 'CPF ou CNPJ' : 'Documento (opcional)'} value={form.document} onChange={e => set('document', e.target.value)} required={role !== 'consumer'} />
                {role === 'merchant' && <>
                  <Input label="Nome comercial" value={form.storeName} onChange={e => set('storeName', e.target.value)} required />
                  <div className="grid grid-cols-2 gap-3">
                    <Select label="Categoria" value={form.categoryId} onChange={e => set('categoryId', e.target.value)}>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
                    <Input label="Telefone da loja" value={form.storePhone} onChange={e => set('storePhone', e.target.value)} />
                  </div>
                  <p className="pt-2 text-xs font-extrabold text-ink/60">Endereço do estabelecimento</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="CEP" value={form.cep} onChange={e => set('cep', cepMask(e.target.value))} onBlur={lookupCep} placeholder="00000-000" required />
                    <Input label="Número" value={form.number} onChange={e => set('number', e.target.value)} required />
                  </div>
                  <Input label="Rua / Avenida" value={form.street} onChange={e => set('street', e.target.value)} required />
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Bairro" value={form.neighborhood} onChange={e => set('neighborhood', e.target.value)} required />
                    <Input label="Complemento" value={form.complement} onChange={e => set('complement', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3"><Input label="Cidade" value={form.city} onChange={e => set('city', e.target.value)} required /><Select label="UF" value={form.state} onChange={e => set('state', e.target.value)}>{['BA','SP','RJ','MG'].map(s => <option key={s}>{s}</option>)}</Select></div>
                </>}
                {role === 'courier' && <div className="grid grid-cols-2 gap-3">
                  <Select label="Transporte" value={form.vehicle} onChange={e => set('vehicle', e.target.value)}><option value="bicycle">Bicicleta</option><option value="motorcycle">Motocicleta</option><option value="car">Carro</option></Select>
                  <Input label="Placa (se houver)" value={form.vehiclePlate} onChange={e => set('vehiclePlate', e.target.value)} />
                </div>}
                <label className="flex items-start gap-2 rounded-2xl bg-mist p-3 text-[11px] text-ink/60">
                  <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5 accent-coral" required />
                  <span>Li e aceito os <Link to="/termos" className="text-coral underline">termos de uso</Link> e a <Link to="/privacidade" className="text-coral underline">política de privacidade</Link>, e autorizo o tratamento dos meus dados conforme a LGPD.</span>
                </label>
              </>}
              {error && <p className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-600">{error}</p>}
              <Button type="submit" loading={busy} className="w-full" size="lg">{mode === 'login' ? 'Entrar' : 'Criar conta'}</Button>
            </form>
            <div className="mt-5 flex items-center gap-2 rounded-2xl bg-emerald-50 p-3 text-[11px] text-emerald-700"><ShieldCheck size={16} />Ambiente seguro: senhas com hash e acesso por perfil.</div>
            {mode === 'login' && <p className="mt-4 text-center text-xs text-ink/50">Acesso administrativo é separado e protegido. <Link to="/admin/entrar" className="font-bold text-coral underline">Área administrativa</Link></p>}
          </Card>
        </div>
      </div>
    </div>
  </div>;
}
