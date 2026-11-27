import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable, RefreshControl } from 'react-native';
import { api, brl, shortDate, getToken } from './lib/api';
import { theme } from './lib/theme';
import { Badge, Button, Card, Empty, Loading, Muted, Title } from './components';

const TABS = [{ key: 'home', label: 'Painel', icon: '🏠' }, { key: 'offers', label: 'Solicitações', icon: '📍' },
  { key: 'deliveries', label: 'Entregas', icon: '🚴' }, { key: 'earnings', label: 'Ganhos', icon: '💰' }];

export default function CourierApp({ user, onLogout }: any) {
  const [tab, setTab] = useState('home'); const [me, setMe] = useState<any>(null);
  const [offers, setOffers] = useState<any[]>([]); const [deliveries, setDeliveries] = useState<any[]>([]); const [earnings, setEarnings] = useState<any>(null);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { const [m, o, d, e] = await Promise.all([api.get('/couriers/me'), api.get('/couriers/offers'), api.get('/couriers/deliveries'), api.get('/couriers/earnings')]);
      setMe(m); setOffers(o.items); setDeliveries(d.items); setEarnings(e); } catch (err: any) { setError(err.message); }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [load]);
  useEffect(() => {
    const token = getToken(); if (!token) return;
    const ws = new WebSocket(`ws://${(process.env.EXPO_PUBLIC_WS_HOST ?? '192.168.1.10:4000')}/ws?token=${token}`);
    ws.onmessage = () => load();
    return () => ws.close();
  }, [load]);
  async function toggleOnline() {
    setBusy(true); try { await api.patch('/couriers/me', { online: !me.courier.online, latitude: -12.555, longitude: -41.55 }); await load(); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  async function accept(id: string) { try { await api.post(`/couriers/offers/${id}/accept`, {}); setError(''); load(); } catch (e: any) { setError(e.message); load(); } }
  async function act(d: any, action: string) {
    try { await api.post(`/couriers/deliveries/${d.id}/${action}`, action === 'location' ? { latitude: -12.556, longitude: -41.551 } : {}); load(); }
    catch (e: any) { setError(e.message); }
  }
  if (!me) return <Loading label="Carregando painel do entregador…" />;
  return <View style={styles.root}>
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
      <Text style={styles.greeting}>Olá, {user.name.split(' ')[0]} 👋</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {me.courier.status === 'pending' && <Card><Title size={17}>Cadastro em análise</Title><Muted>Seu cadastro será aprovado pela administradora antes de aceitar corridas.</Muted></Card>}
      {me.courier.status === 'approved' && <Pressable onPress={toggleOnline} style={[styles.online, me.courier.online && styles.onlineOn]}>
        <Text style={styles.onlineEmoji}>{me.courier.online ? '🟢' : '⚪'}</Text>
        <View><Text style={styles.onlineTitle}>{me.courier.online ? 'VOCÊ ESTÁ ONLINE' : 'VOCÊ ESTÁ OFFLINE'}</Text>
          <Text style={styles.onlineSub}>{me.courier.online ? 'Recebendo solicitações' : 'Toque para ficar online'}</Text></View>
      </Pressable>}

      {tab === 'home' && <>
        <View style={styles.stats}><Card style={styles.stat}><Text style={styles.statValue}>{brl(earnings?.totals?.earnings ?? 0)}</Text><Muted>Ganhos</Muted></Card>
          <Card style={styles.stat}><Text style={styles.statValue}>{earnings?.delivered ?? 0}</Text><Muted>Entregas</Muted></Card></View>
        <Title size={18}>Solicitações recentes</Title>
        {offers.slice(0, 3).map(o => <Card key={o.id}><Text style={styles.storeName}>{o.establishment_name}</Text><Muted>{o.pickup_street}, {o.pickup_number}</Muted>
          <View style={styles.row}><Text style={styles.price}>{brl(o.fee_cents)}</Text><Button style={styles.smallBtn} onPress={() => accept(o.id)}>Aceitar</Button></View></Card>)}
        {offers.length === 0 ? <Empty title="Sem solicitações" text={me.courier.online ? 'Aguarde novas solicitações em tempo real.' : 'Fique online para receber.'} /> : null}
      </>}

      {tab === 'offers' && <>
        <Title>Solicitações disponíveis</Title>
        {offers.length === 0 ? <Empty title="Nada por enquanto" text="Novas ofertas aparecem automaticamente." /> : offers.map(o => <Card key={o.id}>
          <View style={styles.row}><Text style={styles.storeName}>{o.establishment_name}</Text><Text style={styles.price}>{brl(o.fee_cents)}</Text></View>
          <Muted>Retirada: {o.pickup_street}, {o.pickup_number} — {o.pickup_neighborhood}</Muted>
          {o.distanceKm != null && <Muted>Distância: {o.distanceKm} km</Muted>}
          <Button onPress={() => accept(o.id)}>Aceitar entrega</Button>
        </Card>)}
      </>}

      {tab === 'deliveries' && <>
        <Title>Minhas entregas</Title>
        {deliveries.length === 0 ? <Empty title="Sem entregas" text="Aceite uma solicitação para começar." /> : deliveries.map(d => <Card key={d.id}>
          <View style={styles.row}><Text style={styles.storeName}>#{d.id.slice(-6).toUpperCase()}</Text><Badge tone={d.status === 'delivered' ? 'green' : 'blue'}>{d.status.replaceAll('_', ' ')}</Badge></View>
          <Muted>Retirada: {d.pickup_street}, {d.pickup_number}</Muted>
          <Muted>Entrega: {d.dest_street}, {d.dest_number} — {d.dest_neighborhood}</Muted>
          <Muted>{shortDate(d.created_at)} · {brl(d.fee_cents)}</Muted>
          {d.status === 'accepted' && <View style={styles.actions}><Button style={styles.smallBtn} onPress={() => act(d, 'picked')}>Confirmar retirada</Button>
            <Button variant="outline" style={styles.smallBtn} onPress={() => act(d, 'location')}>Compartilhar local</Button></View>}
          {d.status === 'picked_up' && <Button onPress={() => act(d, 'depart')}>Sair para entrega</Button>}
          {d.status === 'on_the_way' && <Button onPress={() => act(d, 'delivered')}>Confirmar entrega</Button>}
        </Card>)}
      </>}

      {tab === 'earnings' && <>
        <Title>Ganhos e repasses</Title>
        <Card><Text style={styles.statValue}>{brl(earnings?.totals?.earnings ?? 0)}</Text><Muted>Total acumulado</Muted></Card>
        {(earnings?.payouts ?? []).map((p: any) => <Card key={p.id}><View style={styles.row}><Text style={styles.storeName}>Pedido #{p.order_id.slice(-6).toUpperCase()}</Text>
          <Text style={styles.price}>{brl(p.amount_cents)}</Text></View><Muted>{p.status} · {shortDate(p.created_at)}</Muted></Card>)}
        {!earnings?.payouts?.length && <Empty title="Sem repasses" text="Seus ganhos surgem após entregas concluídas." />}
        <Button variant="ghost" onPress={onLogout}>Sair da conta</Button>
      </>}
    </ScrollView>
    <View style={styles.tabbar}>{TABS.map(t => <Pressable key={t.key} onPress={() => setTab(t.key)} style={styles.tabItem}>
      <Text style={{ fontSize: 19, opacity: tab === t.key ? 1 : 0.4 }}>{t.icon}</Text>
      <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelOn]}>{t.label}</Text>
    </Pressable>)}</View>
  </View>;
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: theme.mist }, content: { padding: 18, paddingBottom: 100 },
  greeting: { fontSize: 22, fontWeight: '900', color: theme.ink, marginBottom: 12 }, error: { color: '#c62828', fontSize: 12, fontWeight: '700', marginBottom: 8 },
  online: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: theme.ink, borderRadius: 20, padding: 20, marginBottom: 16 },
  onlineOn: { backgroundColor: theme.mint }, onlineEmoji: { fontSize: 28 }, onlineTitle: { color: '#fff', fontWeight: '900', fontSize: 15 }, onlineSub: { color: 'rgba(255,255,255,.75)', fontSize: 11 },
  stats: { flexDirection: 'row', gap: 10 }, stat: { flex: 1 }, statValue: { fontSize: 20, fontWeight: '900', color: theme.ink },
  storeName: { fontSize: 14, fontWeight: '800', color: theme.ink }, price: { color: theme.coral, fontWeight: '900', fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 6 }, actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  smallBtn: { flex: 1, marginTop: 4, paddingHorizontal: 6 }, tabbar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 10, borderTopWidth: 1, borderTopColor: theme.line },
  tabItem: { flex: 1, alignItems: 'center' }, tabLabel: { fontSize: 10, color: theme.muted, marginTop: 2 }, tabLabelOn: { color: theme.coral, fontWeight: '800' } });
