import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { brl, cepMask } from '../../lib/format';
import { useApp } from '../../state/AppContext';
import { DashShell } from '../../components/Layout';
import { Button, Card, Input, Select } from '../../components/ui';

const DAYS = [['sun','Domingo'],['mon','Segunda'],['tue','Terça'],['wed','Quarta'],['thu','Quinta'],['fri','Sexta'],['sat','Sábado']];
export default function MerchantSettings() {
  const { toast } = useApp(); const [e, setE] = useState<any>(null); const [coupons, setCoupons] = useState<any[]>([]);
  const [cpn, setCpn] = useState({ code: '', kind: 'percent', value: 10, minOrderCents: 0 });
  useEffect(() => {
    api.get('/merchant/me').then(r => setE(r.establishment)).catch(() => {});
    api.get('/merchant/coupons').then(r => setCoupons(r.items)).catch(() => {});
  }, []);
  const set = (k: string, v: any) => setE((x: any) => ({ ...x, [k]: v }));
  const setHour = (day: string, k: string, v: any) => setE((x: any) => ({ ...x, openHours: { ...x.openHours, [day]: { ...(x.openHours?.[day] ?? { open: '11:00', close: '22:00', closed: false }), [k]: v } } }));
  async function save() {
    try {
      await api.patch('/merchant/me', { name: e.name, description: e.description, phone: e.phone, logoUrl: e.logoUrl, coverUrl: e.coverUrl,
        cep: e.cep, street: e.street, number: e.number, complement: e.complement, neighborhood: e.neighborhood, city: e.city, state: e.state,
        latitude: e.latitude, longitude: e.longitude, deliveryFeeCents: Number(e.deliveryFeeCents), minOrderCents: Number(e.minOrderCents),
        prepTimeMin: Number(e.prepTimeMin), deliveryRadiusKm: Number(e.deliveryRadiusKm),
        deliveryEnabled: !!e.deliveryEnabled, pickupEnabled: !!e.pickupEnabled, openHours: e.openHours });
      toast('Configurações salvas');
    } catch (err: any) { toast(err.message, 'error'); }
  }
  async function createCoupon() {
    try { await api.post('/merchant/coupons', { ...cpn, value: Number(cpn.value), minOrderCents: Number(cpn.minOrderCents) }); setCpn({ ...cpn, code: '' });
      api.get('/merchant/coupons').then(r => setCoupons(r.items)); toast('Cupom criado'); } catch (err: any) { toast(err.message, 'error'); }
  }
  if (!e) return <DashShell role="merchant" title="Configurações"><p className="text-sm text-ink/50">Carregando…</p></DashShell>;
  return <DashShell role="merchant" title="Configurações comerciais">
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="p-5"><h2 className="mb-4 text-base font-extrabold">Dados e endereço</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Nome comercial" value={e.name} onChange={v => set('name', v.target.value)} />
          <Input label="Telefone" value={e.phone} onChange={v => set('phone', v.target.value)} />
          <div className="sm:col-span-2"><Input label="Descrição" value={e.description} onChange={v => set('description', v.target.value)} /></div>
          <Input label="Logotipo (URL)" value={e.logoUrl ?? ''} onChange={v => set('logoUrl', v.target.value)} />
          <Input label="Imagem de capa (URL)" value={e.coverUrl ?? ''} onChange={v => set('coverUrl', v.target.value)} />
          <Input label="CEP" value={e.cep} onChange={v => set('cep', cepMask(v.target.value))} />
          <Input label="Número" value={e.number} onChange={v => set('number', v.target.value)} />
          <div className="sm:col-span-2"><Input label="Rua" value={e.street} onChange={v => set('street', v.target.value)} /></div>
          <Input label="Bairro" value={e.neighborhood} onChange={v => set('neighborhood', v.target.value)} />
          <Input label="Complemento" value={e.complement ?? ''} onChange={v => set('complement', v.target.value)} />
          <Input label="Cidade" value={e.city} onChange={v => set('city', v.target.value)} />
          <Input label="UF" value={e.state} onChange={v => set('state', v.target.value)} />
          <Input label="Latitude" type="number" step="any" value={e.latitude ?? ''} onChange={v => set('latitude', v.target.value ? Number(v.target.value) : null)} />
          <Input label="Longitude" type="number" step="any" value={e.longitude ?? ''} onChange={v => set('longitude', v.target.value ? Number(v.target.value) : null)} />
        </div>
      </Card>
      <div className="space-y-5">
        <Card className="p-5"><h2 className="mb-4 text-base font-extrabold">Entrega e operação</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Taxa de entrega (R$)" type="number" step="0.01" value={(e.deliveryFeeCents / 100).toFixed(2)} onChange={v => set('deliveryFeeCents', Math.round(Number(v.target.value) * 100))} />
            <Input label="Pedido mínimo (R$)" type="number" step="0.01" value={(e.minOrderCents / 100).toFixed(2)} onChange={v => set('minOrderCents', Math.round(Number(v.target.value) * 100))} />
            <Input label="Tempo de preparo (min)" type="number" value={e.prepTimeMin} onChange={v => set('prepTimeMin', Number(v.target.value))} />
            <Input label="Raio de entrega (km)" type="number" step="0.5" value={e.deliveryRadiusKm} onChange={v => set('deliveryRadiusKm', Number(v.target.value))} />
            <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={!!e.deliveryEnabled} onChange={v => set('deliveryEnabled', v.target.checked)} className="accent-coral" />Entrega habilitada</label>
            <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={!!e.pickupEnabled} onChange={v => set('pickupEnabled', v.target.checked)} className="accent-coral" />Retirada no balcão</label>
          </div>
          <p className="mt-3 text-[11px] text-ink/45">Taxa atual: {brl(e.deliveryFeeCents)} · raio {e.deliveryRadiusKm} km</p>
        </Card>
        <Card className="p-5"><h2 className="mb-4 text-base font-extrabold">Horários de funcionamento</h2>
          <div className="space-y-2">{DAYS.map(([key, label]) => <div key={key} className="grid grid-cols-[90px_1fr_1fr_70px] items-center gap-2 text-xs">
            <span className="font-bold">{label}</span>
            <Input type="time" value={e.openHours?.[key]?.open ?? '11:00'} onChange={v => setHour(key, 'open', v.target.value)} />
            <Input type="time" value={e.openHours?.[key]?.close ?? '22:00'} onChange={v => setHour(key, 'close', v.target.value)} />
            <label className="flex items-center gap-1 text-[10px]"><input type="checkbox" checked={!!e.openHours?.[key]?.closed} onChange={v => setHour(key, 'closed', v.target.checked)} className="accent-coral" />Fechado</label>
          </div>)}</div>
        </Card>
      </div>
    </div>
    <div className="mt-5"><Button onClick={save}>Salvar configurações</Button></div>

    <Card className="mt-6 p-5"><h2 className="mb-4 text-base font-extrabold">Cupons da loja</h2>
      <div className="grid gap-3 sm:grid-cols-4">
        <Input label="Código" value={cpn.code} onChange={v => setCpn({ ...cpn, code: v.target.value.toUpperCase() })} />
        <Select label="Tipo" value={cpn.kind} onChange={v => setCpn({ ...cpn, kind: v.target.value })}><option value="percent">Percentual (%)</option><option value="fixed">Valor fixo (R$)</option></Select>
        <Input label="Valor" type="number" value={cpn.value} onChange={v => setCpn({ ...cpn, value: Number(v.target.value) })} />
        <div className="flex items-end"><Button onClick={createCoupon}>Criar cupom</Button></div>
      </div>
      <div className="mt-4 space-y-2">{coupons.map(c => <div key={c.id} className="flex items-center justify-between rounded-xl bg-mist p-3 text-xs"><b>{c.code}</b><span>{c.kind === 'percent' ? `${c.value}%` : brl(c.value)} · {c.used_count} usos</span></div>)}</div>
    </Card>
  </DashShell>;
}
