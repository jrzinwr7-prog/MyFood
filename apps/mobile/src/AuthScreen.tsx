import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable, Image } from 'react-native';
import { api, setToken } from './lib/api';
import { theme } from './lib/theme';
import { Badge, Button, Input } from './components';

export default function AuthScreen({ onLogin }: any) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<'consumer' | 'courier'>('consumer');
  const [f, setF] = useState<any>({ name: '', email: '', phone: '', password: '', document: '', vehicle: 'motorcycle' });
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  async function submit() {
    setBusy(true); setError('');
    try {
      const r = mode === 'login' ? await api.post('/auth/login', { email: f.email, password: f.password })
        : await api.post('/auth/register', { role, name: f.name, email: f.email, phone: f.phone, password: f.password,
            lgpdConsent: true, ...(role === 'courier' ? { courier: { document: f.document, vehicle: f.vehicle } } : {}) });
      await setToken(r.token); onLogin(r.user);
    } catch (e: any) { setError(e.message); setBusy(false); }
  }
  return <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
    <View style={styles.hero}><Image source={require('../assets/fastdelivery-mark.png')} style={{ width: 66, height: 66, borderRadius: 18, marginBottom: 10 }} accessibilityLabel="Marca FastDelivery" />
      <Text style={styles.brand}>Fast<Text style={{ color: theme.coral }}>Delivery</Text></Text>
      <Text style={styles.tagline}>Delivery local, feito para sua cidade.</Text>
    </View>
    <View style={styles.tabs}>
      <Pressable onPress={() => setMode('login')} style={[styles.tab, mode === 'login' && styles.tabOn]}><Text style={[styles.tabText, mode === 'login' && styles.tabTextOn]}>Entrar</Text></Pressable>
      <Pressable onPress={() => setMode('register')} style={[styles.tab, mode === 'register' && styles.tabOn]}><Text style={[styles.tabText, mode === 'register' && styles.tabTextOn]}>Criar conta</Text></Pressable>
    </View>
    {mode === 'register' && <View style={styles.roles}>
      <Pressable onPress={() => setRole('consumer')} style={[styles.role, role === 'consumer' && styles.roleOn]}><Text style={styles.roleEmoji}>🛍️</Text><Text style={styles.roleText}>Consumidor</Text></Pressable>
      <Pressable onPress={() => setRole('courier')} style={[styles.role, role === 'courier' && styles.roleOn]}><Text style={styles.roleEmoji}>🚴</Text><Text style={styles.roleText}>Entregador</Text></Pressable>
    </View>}
    <Input label="Nome completo" value={f.name} onChangeText={(v: string) => set('name', v)} placeholder="Seu nome" visible={mode === 'register'} />
    {mode === 'register' && <Input label="Celular" value={f.phone} onChangeText={(v: string) => set('phone', v)} placeholder="(74) 99999-0000" keyboardType="phone-pad" />}
    <Input label="E-mail" value={f.email} onChangeText={(v: string) => set('email', v)} placeholder="voce@email.com" keyboardType="email-address" autoCapitalize="none" />
    <Input label="Senha" value={f.password} onChangeText={(v: string) => set('password', v)} placeholder="Mínimo 8 caracteres" secureTextEntry />
    {mode === 'register' && role === 'courier' && <>
      <Input label="CPF" value={f.document} onChangeText={(v: string) => set('document', v)} keyboardType="numeric" />
      <Input label="Transporte (bicycle, motorcycle ou car)" value={f.vehicle} onChangeText={(v: string) => set('vehicle', v)} />
    </>}
    {mode === 'register' && <Text style={styles.consent}>Ao continuar, você aceita os termos de uso e a política de privacidade (LGPD) do FastDelivery.</Text>}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <Button onPress={submit} loading={busy}>{mode === 'login' ? 'Entrar' : 'Criar conta'}</Button>
    <Text style={styles.foot}>Estabelecimentos podem se cadastrar pelo portal web.</Text>
  </ScrollView>;
}
const styles = StyleSheet.create({ container: { padding: 22, paddingTop: 60, backgroundColor: theme.mist, flexGrow: 1 },
  hero: { alignItems: 'center', marginBottom: 26 }, logo: { width: 62, height: 62, borderRadius: 18, backgroundColor: theme.coral, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#fff', fontSize: 34, fontWeight: '900' }, brand: { fontSize: 28, fontWeight: '900', marginTop: 8, color: theme.ink }, tagline: { color: theme.muted, fontSize: 12 },
  tabs: { flexDirection: 'row', backgroundColor: '#e7eaf0', borderRadius: 14, padding: 4, marginBottom: 18 }, tab: { flex: 1, padding: 10, borderRadius: 11, alignItems: 'center' },
  tabOn: { backgroundColor: '#fff' }, tabText: { fontWeight: '700', color: theme.muted }, tabTextOn: { color: theme.ink },
  roles: { flexDirection: 'row', gap: 10, marginBottom: 16 }, role: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: theme.line },
  roleOn: { borderColor: theme.coral, backgroundColor: '#fff5f2' }, roleEmoji: { fontSize: 24 }, roleText: { fontSize: 11, fontWeight: '700', marginTop: 6 },
  consent: { color: theme.muted, fontSize: 11, marginBottom: 6, lineHeight: 16 }, error: { color: '#c62828', fontSize: 12, marginBottom: 6, fontWeight: '700' }, foot: { color: theme.muted, fontSize: 10, textAlign: 'center', marginTop: 20 } });
