import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AuthScreen from './src/AuthScreen';
import ConsumerApp from './src/ConsumerApp';
import CourierApp from './src/CourierApp';
import { api, getToken, setToken } from './src/lib/api';
import { theme } from './src/lib/theme';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      if (await getToken()) { try { const r = await api.get('/auth/me'); setUser(r.user); } catch { await setToken(null); } }
      setLoading(false);
    })();
  }, []);
  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={theme.coral} /></View>;
  const logout = async () => { await setToken(null); setUser(null); };
  return <SafeAreaProvider><SafeAreaView style={styles.root}>
    <StatusBar style="dark" />
    {!user ? <AuthScreen onLogin={setUser} /> :
      user.role === 'consumer' ? <ConsumerApp user={user} onLogout={logout} /> :
      user.role === 'courier' ? <CourierApp user={user} onLogout={logout} /> :
      <View style={styles.center}><Text style={{ fontSize: 18, fontWeight: '700', color: theme.ink }}>
        {user.role === 'merchant' ? 'Use o portal web para gerenciar sua loja.' : 'Use o painel web administrativo.'}</Text></View>}
  </SafeAreaView></SafeAreaProvider>;
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: theme.mist }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 } });
