import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, Modal, ScrollView } from 'react-native';
import { theme } from './lib/theme';
import { Ionicons } from '@expo/vector-icons';

export function Card({ children, style }: any) { return <View style={[styles.card, style]}>{children}</View>; }
export function Title({ children, size = 22 }: any) { return <Text style={[styles.title, { fontSize: size }]}>{children}</Text>; }
export function Muted({ children }: any) { return <Text style={styles.muted}>{children}</Text>; }
export function Button({ children, onPress, variant = 'primary', loading, disabled, style }: any) {
  return <Pressable disabled={loading || disabled} onPress={onPress} style={({ pressed }) => [styles.button,
    variant === 'outline' ? styles.outline : variant === 'ghost' ? styles.ghost : styles.primary,
    pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] }, disabled && { opacity: 0.5 }, style]}>
    {loading ? <ActivityIndicator color="#fff" /> : <Text style={[styles.buttonText, variant !== 'primary' && { color: theme.ink }]}>{children}</Text>}
  </Pressable>;
}
export function Input({ label, value, onChangeText, placeholder, keyboardType, secureTextEntry, multiline, onSubmitEditing, inputStyle, visible = true }: any) {
  if (!visible) return null;
  return <View style={styles.field}>{label ? <Text style={styles.label}>{label}</Text> : null}
    <TextInputCompat value={value} onChangeText={onChangeText} placeholder={placeholder} keyboardType={keyboardType}
      secureTextEntry={secureTextEntry} multiline={multiline} onSubmitEditing={onSubmitEditing} style={[styles.input, multiline && { height: 90, textAlignVertical: 'top' }, inputStyle]} /></View>;
}
// Import separado para manter o componente legível.
import { TextInput } from 'react-native';
const TextInputCompat = TextInput;
export function Badge({ children, tone = 'neutral' }: any) {
  const bg: any = { neutral: theme.mist, green: '#e7f8f0', red: '#fdeaea', orange: '#fff2e2', blue: '#fff2e2' };
  const fg: any = { neutral: theme.ink, green: '#0a7f5b', red: '#c62828', orange: '#b45309', blue: '#9a3412' };
  return <View style={[styles.badge, { backgroundColor: bg[tone] }]}><Text style={[styles.badgeText, { color: fg[tone] }]}>{children}</Text></View>;
}
export function Empty({ title, text }: any) { return <View style={styles.empty}><View style={styles.emptyIcon}><Ionicons name="file-tray-outline" size={26} color={theme.coral}/></View><Title size={17}>{title}</Title><Muted>{text}</Muted></View>; }
export function Loading({ label = 'Carregando…' }: any) { return <View style={styles.loading}><ActivityIndicator color={theme.coral} size="large" /><Muted>{label}</Muted></View>; }
export function Overlay({ visible, onClose, children }: any) {
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={styles.overlayBg}><Pressable style={{ flex: 1 }} onPress={onClose} />
      <View style={styles.overlayCard}><ScrollView>{children}</ScrollView></View>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 12,
    shadowColor: '#402920', shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
  title: { fontWeight: '800', color: theme.ink }, muted: { color: theme.muted, fontSize: 12, lineHeight: 18 },
  button: { height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, marginTop: 8 },
  primary: { backgroundColor: theme.coral }, outline: { backgroundColor: '#fff', borderWidth: 1, borderColor: theme.line },
  ghost: { backgroundColor: theme.mist }, buttonText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  field: { marginBottom: 12 }, label: { fontSize: 12, fontWeight: '700', color: theme.ink, marginBottom: 6 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: theme.line, borderRadius: 14, paddingHorizontal: 14,
    minHeight: 46, fontSize: 14, color: theme.ink },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginRight: 6, marginBottom: 4 },
  emptyIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8eae1', marginBottom: 5 },
  badgeText: { fontSize: 10, fontWeight: '800' }, empty: { alignItems: 'center', padding: 40, gap: 8 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  overlayBg: { flex: 1, backgroundColor: 'rgba(52,35,27,.55)', justifyContent: 'flex-end' },
  overlayCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '88%' },
});
