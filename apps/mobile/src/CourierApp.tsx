import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable, RefreshControl, Linking } from 'react-native';
import * as Location from 'expo-location';
import { api, brl, shortDate, getToken, API_URL } from './lib/api';
import { theme } from './lib/theme';
import { Ionicons } from '@expo/vector-icons';
import AiSupport from './AiSupport';
import { Badge, Button, Card, Empty, Loading, Muted, Title } from './components';

const TABS = [{ key: 'home', label: 'Painel', icon: 'home-outline' }, { key: 'offers', label: 'Solicitações', icon: 'location-outline' },
  { key: 'deliveries', label: 'Entregas', icon: 'bicycle-outline' }, { key: 'earnings', label: 'Ganhos', icon: 'wallet-outline' }, { key: 'support', label: 'Suporte', icon: 'chatbubble-outline' }] as const;

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
    let ws: WebSocket | null = null; let closed = false;
    getToken().then(token => {
      if (!token || closed) return;
      const url = new URL(API_URL); url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${url.origin}/ws?token=${encodeURIComponent(token)}`);
      ws.onmessage = () => load();
    });
    return () => { closed = true; ws?.close(); };
  }, [load]);
  async function currentLocation() {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') throw new Error('Permita a localização para usar o GPS nas entregas.');
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  }
  async function navigateTo(parts: (string | null | undefined)[]) {
    const destination = parts.filter(Boolean).join(', ');
    if (!destination) { setError('Endereço indisponível para navegação.'); return; }
    try { await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`); }
    catch { setError('Não foi possível abrir o mapa neste aparelho.'); }
  }
  async function toggleOnline() {
    setBusy(true); try { const online = !me.courier.online; const coords = online ? await currentLocation() : {}; await api.patch('/couriers/me', { online, ...coords }); await load(); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  async function accept(id: string) { try { await api.post(`/couriers/offers/${id}/accept`, {}); setError(''); load(); } catch (e: any) { setError(e.message); load(); } }
  async function act(d: any, action: string) {
    try { const body = action === 'location' ? await currentLocation() : {}; await api.post(`/couriers/deliveries/${d.id}/${action}`, body); load(); }
    catch (e: any) { setError(e.message); }
  }
  if (!me) return <Loading label="Carregando painel do entregador…" />;
  return <View style={styles.root}>
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
      <Text style={styles.greeting}>Olá, {user.name.split(' ')[0]}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {me.courier.status === 'pending' && <Card><Title size={17}>Cadastro em análise</Title><Muted>Seu cadastro será aprovado pela administradora antes de aceitar corridas.</Muted></Card>}
      {me.courier.status === 'approved' && <Pressable onPress={toggleOnline} disabled={busy} accessibilityRole="button" accessibilityState={{ disabled: busy }} style={[styles.online, me.courier.online && styles.onlineOn, busy && { opacity: 0.6 }]}>
        <View style={[styles.onlineDot, me.courier.online && styles.onlineDotOn]} />
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
          <Muted>Região da entrega: {o.dest_neighborhood}, {o.dest_city}/{o.dest_state}</Muted>
          <Muted>Valor exibido é a taxa bruta; não representa necessariamente o ganho líquido.</Muted>
          {o.distanceKm != null && <Muted>Distância em linha reta até a loja: {o.distanceKm} km</Muted>}
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
          {['accepted', 'picked_up', 'on_the_way'].includes(d.status) && <View>
            <Button variant="outline" onPress={() => navigateTo([d.pickup_street, d.pickup_number, d.pickup_neighborhood, d.pickup_city, d.pickup_state])}>Rota até a retirada · Google Maps</Button>
            <Button variant="outline" onPress={() => navigateTo([d.dest_street, d.dest_number, d.dest_neighborhood, d.dest_city, d.dest_state])}>Rota até a entrega · Google Maps</Button>
            <Muted>Ao abrir a rota, o endereço será compartilhado com o Google Maps.</Muted>
          </View>}
          {d.status === 'accepted' && <View style={styles.actions}><Button style={styles.smallBtn} onPress={() => act(d, 'picked')}>Confirmar retirada</Button>
            <Button variant="outline" style={styles.smallBtn} onPress={() => act(d, 'location')}>Compartilhar local</Button></View>}
          {d.status === 'picked_up' && <><Button onPress={() => act(d, 'depart')}>Sair para entrega</Button><Button variant="outline" onPress={() => act(d, 'location')}>Atualizar localização</Button></>}
          {d.status === 'on_the_way' && <><Button onPress={() => act(d, 'delivered')}>Confirmar entrega</Button><Button variant="outline" onPress={() => act(d, 'location')}>Atualizar localização</Button></>}
        </Card>)}
      </>}

      {tab === 'support' && <AiSupport />}

      {tab === 'earnings' && <>
        <Title>Ganhos e repasses</Title>
        <Card><Text style={styles.statValue}>{brl(earnings?.totals?.earnings ?? 0)}</Text><Muted>Total acumulado</Muted></Card>
        {(earnings?.payouts ?? []).map((p: any) => <Card key={p.id}><View style={styles.row}><Text style={styles.storeName}>Pedido #{p.order_id.slice(-6).toUpperCase()}</Text>
          <Text style={styles.price}>{brl(p.amount_cents)}</Text></View><Muted>{p.status} · {shortDate(p.created_at)}</Muted></Card>)}
        {!earnings?.payouts?.length && <Empty title="Sem repasses" text="Seus ganhos surgem após entregas concluídas." />}
        <Button variant="ghost" onPress={onLogout}>Sair da conta</Button>
      </>}
    </ScrollView>
    <View style={styles.tabbar}>{TABS.map(t => <Pressable key={t.key} onPress={() => setTab(t.key)} accessibilityRole="tab" accessibilityState={{ selected: tab === t.key }} style={styles.tabItem}>
      <View style={[styles.tabIcon, tab === t.key && styles.tabIconOn]}><Ionicons name={t.icon} size={20} color={tab === t.key ? theme.coral : theme.muted} /></View>
      <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelOn]}>{t.label}</Text>
    </Pressable>)}</View>
  </View>;
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: theme.mist }, content: { padding: 18, paddingBottom: 100 },
  greeting: { fontSize: 22, fontWeight: '900', color: theme.ink, marginBottom: 12 }, error: { color: '#c62828', fontSize: 12, fontWeight: '700', marginBottom: 8 },
  online: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: theme.ink, borderRadius: 20, padding: 20, marginBottom: 16 },
  onlineOn: { backgroundColor: theme.mint }, onlineDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#cab9a8', borderWidth: 2, borderColor: '#fff' }, onlineDotOn: { backgroundColor: '#b8edbd' }, onlineTitle: { color: '#fff', fontWeight: '900', fontSize: 15 }, onlineSub: { color: 'rgba(255,255,255,.75)', fontSize: 11 },
  stats: { flexDirection: 'row', gap: 10 }, stat: { flex: 1 }, statValue: { fontSize: 20, fontWeight: '900', color: theme.ink },
  storeName: { fontSize: 14, fontWeight: '800', color: theme.ink }, price: { color: theme.coral, fontWeight: '900', fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 6 }, actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  smallBtn: { flex: 1, marginTop: 4, paddingHorizontal: 6 }, tabbar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 10, borderTopWidth: 1, borderTopColor: theme.line },
  tabItem: { flex: 1, alignItems: 'center' }, tabIcon: { paddingHorizontal: 11, paddingVertical: 3, borderRadius: 12 }, tabIconOn: { backgroundColor: '#f9ebe2' }, tabLabel: { fontSize: 10, color: theme.muted, marginTop: 2 }, tabLabelOn: { color: theme.coral, fontWeight: '800' } });
