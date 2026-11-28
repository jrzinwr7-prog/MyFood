import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable, RefreshControl, Image, Animated, AccessibilityInfo, Easing } from 'react-native';
import { api, brl, shortDate, getToken } from './lib/api';
import { theme } from './lib/theme';
import { Ionicons } from '@expo/vector-icons';
import AiSupport from './AiSupport';
import { Badge, Button, Card, Empty, Input, Loading, Muted, Overlay, Title } from './components';

const TABS = [{ key: 'home', label: 'Início', icon: 'home-outline' }, { key: 'orders', label: 'Pedidos', icon: 'receipt-outline' },
  { key: 'chat', label: 'Conversas', icon: 'chatbubble-ellipses-outline' }, { key: 'profile', label: 'Perfil', icon: 'person-outline' }] as const;

export default function ConsumerApp({ user, onLogout }: any) {
  const [tab, setTab] = useState('home');
  const intro = useRef(new Animated.Value(1)).current;
  const storeRequest = useRef(0);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (!active || reduced) return;
      intro.setValue(0);
      Animated.timing(intro, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }).catch(() => {});
    return () => { active = false; intro.stopAnimation(); };
  }, [intro]);
  const [view, setView] = useState<any>({ name: 'home' });
  const [stores, setStores] = useState<any[]>([]);
  const [storeError, setStoreError] = useState(false);
  const [storesLoading, setStoresLoading] = useState(true);
  const [categories, setCategories] = useState<any[]>([]);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [store, setStore] = useState<any>(null);
  const [product, setProduct] = useState<any>(null);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');
  const [cart, setCart] = useState<any>(null);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [addressId, setAddressId] = useState('');
  const [payment, setPayment] = useState('pix_manual');
  const [order, setOrder] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [convs, setConvs] = useState<any[]>([]);
  const [activeConv, setActiveConv] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadStores = useCallback(async () => {
    const request = ++storeRequest.current;
    setStoresLoading(true);
    try {
      const qs = new URLSearchParams();
      if (category) qs.set('category', category);
      if (search) qs.set('q', search);
      const r = await api.get(`/catalog/establishments?${qs}`); if (request === storeRequest.current) { setStores(r.items); setStoreError(false); }
    } catch { if (request === storeRequest.current) { setStores([]); setStoreError(true); } } finally { if (request === storeRequest.current) setStoresLoading(false); }
  }, [category, search]);
  const loadBase = useCallback(async () => {
    try {
      const [c, a] = await Promise.all([api.get('/catalog/categories'), api.get('/addresses')]);
      setCategories(c.items); setAddresses(a.items); setAddressId(a.items.find((x: any) => x.is_default)?.id ?? a.items[0]?.id ?? '');
    } catch { /* sem conexão */ }
  }, []);
  const loadOrders = useCallback(async () => { try { const r = await api.get('/orders/mine'); setOrders(r.items); } catch {} }, []);
  const loadConvs = useCallback(async () => { try { const r = await api.get('/chat/conversations'); setConvs(r.items); } catch {} }, []);
  useEffect(() => { loadBase(); loadOrders(); loadConvs(); }, []);
  useEffect(() => { loadStores(); }, [loadStores]);
  useEffect(() => {
    const token = getToken(); if (!token) return;
    const ws = new WebSocket(`ws://${(process.env.EXPO_PUBLIC_WS_HOST ?? '192.168.1.10:4000')}/ws?token=${token}`);
    ws.onmessage = e => { try { const m = JSON.parse(e.data); if (m.type === 'order:updated' || m.type === 'notification') { loadOrders(); loadConvs(); } } catch {} };
    return () => ws.close();
  }, []);

  async function openStore(slug: string) {
    try { const r = await api.get(`/catalog/establishments/${slug}`); setStore(r); setView({ name: 'store', slug }); }
    catch (e: any) { setError(e.message); }
  }
  function chooseOption(g: any, o: any) {
    setSelected(p => { const cur = p[g.id] ?? [];
      if (cur.includes(o.id)) return { ...p, [g.id]: cur.filter(x => x !== o.id) };
      if (g.maxSelected === 1) return { ...p, [g.id]: [o.id] };
      return cur.length < g.maxSelected ? { ...p, [g.id]: [...cur, o.id] } : p; });
  }
  function addToCart() {
    if (!product || !store) return;
    const options: any[] = [];
    for (const g of product.groups ?? []) {
      for (const id of selected[g.id] ?? []) { const o = g.options.find((x: any) => x.id === id); if (o) options.push({ group_name: g.name, option_name: o.name, price_cents: o.priceCents, option_id: o.id }); }
      if ((selected[g.id]?.length ?? 0) < g.minSelected) { setError(`Selecione ${g.minSelected} opção(ões) de ${g.name}`); return; }
    }
    const unit = product.priceCents;
    const item = { key: `${product.id}|${Date.now()}`, product_id: product.id, name: product.name, unit_price_cents: unit,
      quantity: qty, options, notes: notes || null, image_url: product.imageUrl };
    const base = cart && cart.establishmentId === store.establishment.id ? cart
      : { establishmentId: store.establishment.id, establishmentName: store.establishment.name, deliveryFeeCents: store.establishment.deliveryFeeCents, items: [] };
    setCart({ ...base, items: [...base.items, item] }); setProduct(null); setError('');
  }
  function setQtyItem(key: string, delta: number) {
    const items = cart.items.map((i: any) => i.key === key ? { ...i, quantity: i.quantity + delta } : i).filter((i: any) => i.quantity > 0);
    setCart({ ...cart, items });
  }
  const subtotal = (cart?.items ?? []).reduce((s: number, i: any) => s + (i.unit_price_cents + i.options.reduce((a: number, o: any) => a + o.price_cents, 0)) * i.quantity, 0);

  async function placeOrder() {
    if (!cart || !addressId) { setError('Selecione um endereço de entrega'); return; }
    setBusy(true); setError('');
    try {
      const created = await api.post('/orders', { establishmentId: cart.establishmentId, addressId, paymentMethod: payment,
        items: cart.items.map((i: any) => ({ productId: i.product_id, quantity: i.quantity, notes: i.notes,
          selectedOptions: i.options.filter((o: any) => o.option_id).map((o: any) => ({ optionId: o.option_id })) })) });
      try { await api.post(`/payments/orders/${created.order.id}/initialize`, { method: payment }); } catch (e: any) { setError(`Pedido criado, mas pagamento pendente: ${e.message}`); }
      setCart(null); setOrder(await api.get(`/orders/${created.order.id}`)); setView({ name: 'tracking' }); loadOrders();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  async function openTracking(id: string) { try { setOrder(await api.get(`/orders/${id}`)); setView({ name: 'tracking' }); } catch (e: any) { setError(e.message); } }
  async function openConversation(id: string) { try { setActiveConv((await api.get(`/chat/conversations/${id}/messages`)).conversation);
    setMessages((await api.get(`/chat/conversations/${id}/messages`)).items); setView({ name: 'chat' }); } catch (e: any) { setError(e.message); } }
  async function sendMessage() { if (!msg.trim() || !activeConv) return; try { const r = await api.post(`/chat/conversations/${activeConv.id}/messages`, { body: msg });
    setMessages(m => [...m, r.message]); setMsg(''); loadConvs(); } catch (e: any) { setError(e.message); } }

  return <View style={styles.root}>
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={false} onRefresh={() => { loadStores(); loadOrders(); loadConvs(); }} />}>
      {view.name === 'home' && <>
        <View style={styles.brandBar}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}><Image source={require('../assets/fastdelivery-mark.png')} style={styles.brandIcon} /><View><Text style={styles.brandName}>FastDelivery</Text><Text style={styles.brandCaption}>DELIVERY LOCAL</Text></View></View><Pressable accessibilityLabel="Abrir perfil" onPress={() => { setTab('profile'); setView({ name: 'profile' }); }} style={styles.profileButton}><Ionicons name="person-outline" size={21} color={theme.ink} /></Pressable></View>
        <Animated.View style={[styles.hero, { opacity: intro, transform: [{ translateY: intro.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
          <View style={styles.heroCopy}><Text style={styles.heroEyebrow}>SEU DELIVERY, DO SEU JEITO</Text><Text style={styles.heroTitle}>O melhor da cidade. <Text style={styles.heroAccent}>Mais perto de você.</Text></Text>
          <Text style={styles.heroSub}>Descubra lojas e sabores da sua cidade.</Text></View>
          <Image source={require('../assets/fastdelivery-hero.jpg')} style={styles.heroImage} />
        </Animated.View>
        <View style={styles.searchBox}><Ionicons name="search-outline" size={20} color="#826d5f" /><View style={{ flex: 1, marginBottom: -12 }}><Input inputStyle={{ borderWidth: 0 }} placeholder="O que você quer pedir?" value={search} onChangeText={setSearch} onSubmitEditing={loadStores} /></View></View>
        <View style={styles.sectionIntro}><Text style={styles.sectionTitle}>Explore categorias</Text><Text style={styles.sectionCaption}>Escolha o que combina com você</Text></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
          <Pressable onPress={() => setCategory('')} style={[styles.chip, !category && styles.chipOn]}><Text style={[styles.chipText, !category && styles.chipTextOn]}>Todos</Text></Pressable>
          {categories.map(c => <Pressable key={c.id} onPress={() => setCategory(c.id)} style={[styles.chip, category === c.id && styles.chipOn]}>
            <Text style={[styles.chipText, category === c.id && styles.chipTextOn]}>{c.name}</Text></Pressable>)}
        </ScrollView>
        <View style={styles.sectionIntro}><Text style={styles.sectionTitle}>Explore estabelecimentos</Text><Text style={styles.sectionCaption}>{storesLoading ? 'Carregando...' : storeError ? 'Não foi possível carregar as lojas.' : `${stores.length} estabelecimento${stores.length === 1 ? '' : 's'}`}</Text></View>
        {storeError && <Button variant="outline" onPress={loadStores}>Tentar novamente</Button>}
        {!storesLoading && !storeError && stores.length === 0 && <Empty title="Nenhuma loja encontrada" text="Tente outra busca ou categoria." />}
        {stores.map(s => <Pressable key={s.id} onPress={() => openStore(s.slug)} style={({ pressed }) => [styles.storeCard, pressed && { opacity: .85, transform: [{ scale: .99 }] }]}>
          <View style={styles.storeIcon}><Text style={{ fontSize: 23, color: theme.coral, fontWeight: '800' }}>{s.name.charAt(0)}</Text></View>
          <View style={{ flex: 1 }}><Text style={styles.storeName}>{s.name}</Text>
            <Muted>{s.categoryName} · {s.neighborhood}</Muted>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
              <Badge tone={s.isOpen ? 'green' : 'red'}>{s.isOpen ? 'Aberto' : 'Fechado'}</Badge>
              <Badge>Entrega · {s.deliveryFeeCents ? brl(s.deliveryFeeCents) : 'Grátis'}</Badge>
              <Badge>Avaliação · {s.ratingAvg ? s.ratingAvg.toFixed(1) : 'Novo'}</Badge>
            </View>
          </View>
        </Pressable>)}
      </>}

      {view.name === 'store' && store && <>
        <Pressable onPress={() => setView({ name: 'home' })}><Text style={styles.back}>← Voltar</Text></Pressable>
        <Title size={24}>{store.establishment.name}</Title><Muted>{store.establishment.description}</Muted>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
          <Badge tone={store.establishment.isOpen ? 'green' : 'red'}>{store.establishment.isOpen ? 'Aberto agora' : 'Fechado'}</Badge>
          <Badge>Tempo · {store.establishment.prepTimeMin} min</Badge>
          <Badge>Entrega · {brl(store.establishment.deliveryFeeCents)}</Badge>
        </View>
        <Title size={18} style={{ marginTop: 18 }}>Cardápio</Title>
        {store.products.map((p: any) => <Pressable key={p.id} onPress={() => { setProduct(p); setSelected({}); setQty(1); setNotes(''); setError(''); }} style={styles.productCard}>
          <View style={styles.productIcon}><Ionicons name="restaurant-outline" size={24} color="#a4775b" /></View>
          <View style={{ flex: 1 }}><Text style={styles.storeName}>{p.name}</Text><Muted numberOfLines={2}>{p.description}</Muted><Text style={styles.price}>{brl(p.priceCents)}</Text></View>
        </Pressable>)}
        {cart?.establishmentId === store.establishment.id && cart.items.length > 0 && <Button onPress={() => setView({ name: 'cart' })}>Ver carrinho · {brl(subtotal)}</Button>}
      </>}

      {view.name === 'cart' && <>
        <Pressable onPress={() => setView({ name: 'store' })}><Text style={styles.back}>← Continuar comprando</Text></Pressable>
        <Title>Seu carrinho</Title>
        {cart?.items.map((i: any) => <Card key={i.key}>
          <Text style={styles.storeName}>{i.name}</Text>
          {i.options.length > 0 && <Muted>{i.options.map((o: any) => o.option_name).join(', ')}</Muted>}
          {i.notes ? <Muted>Obs.: {i.notes}</Muted> : null}
          <View style={styles.row}><Text style={styles.price}>{brl((i.unit_price_cents + i.options.reduce((a: number, o: any) => a + o.price_cents, 0)) * i.quantity)}</Text>
            <View style={styles.qty}><Pressable onPress={() => setQtyItem(i.key, -1)} style={styles.qtyBtn}><Text>−</Text></Pressable>
              <Text>{i.quantity}</Text><Pressable onPress={() => setQtyItem(i.key, 1)} style={styles.qtyBtn}><Text>+</Text></Pressable></View>
          </View>
        </Card>)}
        <Card><View style={styles.row}><Muted>Subtotal</Muted><Text>{brl(subtotal)}</Text></View>
          <View style={styles.row}><Muted>Entrega</Muted><Text>{brl(cart?.deliveryFeeCents ?? 0)}</Text></View>
          <View style={styles.row}><Title size={18}>Total</Title><Text style={styles.price}>{brl(subtotal + (cart?.deliveryFeeCents ?? 0))}</Text></View></Card>
        <Title size={16}>Endereço de entrega</Title>
        {addresses.map(a => <Pressable key={a.id} onPress={() => setAddressId(a.id)} style={[styles.address, addressId === a.id && styles.addressOn]}>
          <Text style={styles.storeName}>{a.label}</Text><Muted>{a.street}, {a.number} — {a.neighborhood}</Muted></Pressable>)}
        <Title size={16}>Pagamento</Title>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <Pressable onPress={() => setPayment('pix_manual')} style={[styles.chip, payment === 'pix_manual' && styles.chipOn]}><Text style={styles.chipText}>PIX manual</Text></Pressable>
          <Pressable onPress={() => setPayment('cash')} style={[styles.chip, payment === 'cash' && styles.chipOn]}><Text style={styles.chipText}>Dinheiro</Text></Pressable>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button loading={busy} onPress={placeOrder}>Confirmar pedido</Button>
      </>}

      {view.name === 'tracking' && order && <>
        <Pressable onPress={() => setView({ name: 'home' })}><Text style={styles.back}>← Início</Text></Pressable>
        <Title>Pedido #{order.order.id.slice(-6).toUpperCase()}</Title><Badge tone="blue">{order.order.statusLabel}</Badge>
        {order.payment?.status === 'pending' && <Card><Text style={styles.storeName}>Pagamento pendente</Text>
          <Muted>{order.payment.method === 'cash' ? 'Pague em dinheiro na entrega. O estabelecimento confirmará o recebimento.' : 'PIX manual: aguarde as instruções do estabelecimento. Nada foi debitado automaticamente.'}</Muted></Card>}
        <Card><Title size={16}>Resumo do pedido</Title>{order.items.map((i: any) => <View key={i.id} style={styles.row}><Muted>{i.quantity}× {i.name_snapshot}</Muted><Text>{brl(i.total_cents)}</Text></View>)}
          <View style={styles.row}><Title size={16}>Total</Title><Text style={styles.price}>{brl(order.order.total_cents)}</Text></View></Card>
        <Card><Title size={16}>Histórico</Title>{order.history.map((h: any) => <View key={h.id} style={styles.row}><Muted>{h.to_status.replaceAll('_', ' ')}</Muted><Muted>{shortDate(h.created_at)}</Muted></View>)}</Card>
        {order.conversationId && <Button variant="outline" onPress={() => openConversation(order.conversationId)}>Conversar com a loja</Button>}
      </>}

      {view.name === 'orders' && <>
        <Title>Meus pedidos</Title>
        {orders.length === 0 ? <Empty title="Nenhum pedido ainda" text="Seu histórico aparecerá aqui." /> : orders.map(o => <Pressable key={o.id} onPress={() => openTracking(o.id)}><Card>
          <View style={styles.row}><Text style={styles.storeName}>{o.establishment_name}</Text><Badge tone={o.status === 'delivered' ? 'green' : 'blue'}>{o.statusLabel}</Badge></View>
          <Muted>#{o.id.slice(-6).toUpperCase()} · {shortDate(o.created_at)}</Muted><Text style={styles.price}>{brl(o.total_cents)}</Text>
        </Card></Pressable>)}
      </>}

      {view.name === 'chat' && <>
        <Pressable onPress={() => setView({ name: 'chatList' })}><Text style={styles.back}>← Conversas</Text></Pressable>
        <Title>{activeConv?.establishment_name ?? 'Conversa'}</Title>
        {messages.map(m => <View key={m.id} style={[styles.message, m.sender_id === user.id && styles.messageMine]}>
          <Text style={{ color: m.sender_id === user.id ? '#fff' : theme.ink }}>{m.body}</Text>
          <Text style={{ fontSize: 9, opacity: 0.6 }}>{shortDate(m.created_at)}</Text></View>)}
        <Input placeholder="Escreva uma mensagem" value={msg} onChangeText={setMsg} />
        <Button onPress={sendMessage}>Enviar mensagem</Button>
      </>}

      {view.name === 'chatList' && <>
        <Title>Conversas</Title>
        {convs.length === 0 ? <Empty title="Sem conversas" text="Conversas surgem quando você faz um pedido." /> : convs.map(c => <Pressable key={c.id} onPress={() => openConversation(c.id)}><Card>
          <Text style={styles.storeName}>{c.establishment_name ?? 'Entrega'}</Text><Muted numberOfLines={1}>{c.last_message ?? 'Nova conversa'}</Muted>
        </Card></Pressable>)}
      </>}

      {view.name === 'aiSupport' && <><Pressable onPress={() => setView({ name: 'profile' })}><Text style={styles.back}>← Voltar</Text></Pressable><AiSupport /></>}

      {view.name === 'profile' && <>
        <Title>Olá, {user.name.split(' ')[0]}</Title><Muted>{user.email}</Muted>
        <Card><Title size={16}>Seus endereços</Title>{addresses.length === 0 ? <Muted>Nenhum endereço cadastrado. Cadastre pelo site.</Muted> : addresses.map(a =>
          <View key={a.id} style={styles.row}><Text>{a.label}</Text><Muted>{a.street}, {a.number}</Muted></View>)}</Card>
        <Button variant="outline" onPress={() => setView({ name: 'aiSupport' })}>Conversar com suporte IA</Button>
        <Button variant="outline" onPress={async () => { try { const r = await api.get('/auth/lgpd/export'); alert(`Seus dados: ${Object.keys(r.data).join(', ')}. Solicite exportação completa pelo site.`); } catch (e: any) { setError(e.message); } }}>Exportar meus dados (LGPD)</Button>
        <Button variant="ghost" onPress={onLogout}>Sair da conta</Button>
      </>}
    </ScrollView>
    <View style={styles.tabbar}>{TABS.map(t => <Pressable key={t.key} onPress={() => { setTab(t.key); setView({ name: t.key === 'home' ? 'home' : t.key === 'orders' ? 'orders' : t.key === 'chat' ? 'chatList' : 'profile' }); }}
      accessibilityRole="tab" accessibilityState={{ selected: tab === t.key }} style={styles.tabItem}><View style={[styles.tabIcon, tab === t.key && styles.tabIconOn]}><Ionicons name={t.icon} size={20} color={tab === t.key ? theme.coral : theme.muted} /></View>
      <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelOn]}>{t.label}</Text></Pressable>)}</View>

    <Overlay visible={!!product} onClose={() => setProduct(null)}>
      {product && <><Title size={20}>{product.name}</Title><Muted>{product.description}</Muted><Text style={styles.price}>{brl(product.priceCents)}</Text>
        {(product.groups ?? []).map((g: any) => <View key={g.id} style={{ marginTop: 12 }}>
          <Text style={styles.storeName}>{g.name} (máx. {g.maxSelected})</Text>
          {g.options.map((o: any) => <Pressable key={o.id} onPress={() => chooseOption(g, o)} style={[styles.option, (selected[g.id] ?? []).includes(o.id) && styles.optionOn]}>
            <Text>{o.name}</Text><Text>{o.priceCents ? `+ ${brl(o.priceCents)}` : 'Incluído'}</Text></Pressable>)}
        </View>)}
        <Input label="Observações" value={notes} onChangeText={setNotes} multiline />
        <View style={styles.row}><Button variant="outline" onPress={() => setQty(Math.max(1, qty - 1))}>−</Button><Text>{qty}</Text><Button variant="outline" onPress={() => setQty(qty + 1)}>+</Button></View>
        <Button onPress={addToCart}>Adicionar ao carrinho</Button>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </>}
    </Overlay>
  </View>;
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: theme.mist }, content: { padding: 18, paddingBottom: 100 },
  brandBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }, brandIcon: { width: 43, height: 43, borderRadius: 13 }, brandName: { fontSize: 16, fontWeight: '900', color: theme.ink, letterSpacing: -.5 }, brandCaption: { fontSize: 9, letterSpacing: 1, fontWeight: '700', color: theme.muted }, profileButton: { width: 43, height: 43, borderRadius: 15, backgroundColor: '#fff', borderWidth: 1, borderColor: theme.line, alignItems: 'center', justifyContent: 'center' },
  hero: { backgroundColor: '#f1e5d8', borderRadius: 26, overflow: 'hidden', borderWidth: 1, borderColor: theme.line, marginBottom: 14 }, heroCopy: { padding: 23 }, heroTitle: { color: theme.ink, fontSize: 27, fontWeight: '900', letterSpacing: -1, lineHeight: 32 }, heroAccent: { color: theme.coral },
  heroEyebrow: { color: '#9b3c25', fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 10 }, heroSub: { color: '#705c4e', fontSize: 13, lineHeight: 19, marginTop: 9 }, heroImage: { width: '100%', height: 130, resizeMode: 'cover' }, searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 15, backgroundColor: '#fff', borderWidth: 1, borderColor: theme.line, borderRadius: 16, marginBottom: 24 }, sectionIntro: { marginBottom: 12 }, sectionTitle: { fontSize: 20, fontWeight: '900', color: theme.ink, letterSpacing: -.5 }, sectionCaption: { fontSize: 12, color: theme.muted, marginTop: 3 }, chips: { marginBottom: 24 }, chip: { paddingHorizontal: 17, paddingVertical: 12, backgroundColor: '#fff', borderRadius: 14, marginRight: 8, borderWidth: 1, borderColor: theme.line },
  chipOn: { backgroundColor: theme.coral, borderColor: theme.coral }, chipText: { fontSize: 11, fontWeight: '700', color: theme.ink }, chipTextOn: { color: '#fff' },
  storeCard: { flexDirection: 'row', gap: 12, backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: theme.line, shadowColor: '#402920', shadowOpacity: .06, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  storeIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: '#fff2ee', alignItems: 'center', justifyContent: 'center' },
  storeName: { fontSize: 14, fontWeight: '800', color: theme.ink }, price: { color: theme.coral, fontWeight: '900', fontSize: 15, marginTop: 6 },
  productCard: { flexDirection: 'row', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 12, marginBottom: 8 }, productIcon: { width: 54, height: 54, borderRadius: 12, backgroundColor: '#fff8f1', alignItems: 'center', justifyContent: 'center' },
  back: { color: theme.coral, fontWeight: '700', marginBottom: 10 }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginVertical: 4 },
  qty: { flexDirection: 'row', alignItems: 'center', gap: 10 }, qtyBtn: { backgroundColor: theme.mist, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  address: { backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: theme.line }, addressOn: { borderColor: theme.coral, backgroundColor: '#fff5f2' },
  error: { color: '#c62828', fontSize: 12, fontWeight: '700', marginVertical: 6 }, message: { backgroundColor: '#fff', padding: 12, borderRadius: 14, marginVertical: 4, maxWidth: '85%' },
  messageMine: { backgroundColor: theme.ink, alignSelf: 'flex-end' }, option: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginVertical: 4, borderWidth: 1, borderColor: theme.line },
  optionOn: { borderColor: theme.coral, backgroundColor: '#fff5f2' }, tabbar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 10, borderTopWidth: 1, borderTopColor: theme.line },
  tabItem: { flex: 1, alignItems: 'center' }, tabIcon: { paddingHorizontal: 14, paddingVertical: 3, borderRadius: 12 }, tabIconOn: { backgroundColor: '#f9ebe2' }, tabLabel: { fontSize: 10, color: theme.muted, marginTop: 2 }, tabLabelOn: { color: theme.coral, fontWeight: '800' } });
