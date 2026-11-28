import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { api } from './lib/api';
import { Button, Card, Input, Muted, Title } from './components';
import { theme } from './lib/theme';

function SupportText({ text }: { text: string }) {
  return <>{text.split(/(\*\*[^*\n]+\*\*)/g).map((part, i) => part.startsWith('**') && part.endsWith('**') ? <Text key={i} style={{ fontWeight: '700' }}>{part.slice(2, -2)}</Text> : part)}</>;
}
type Message = { role: 'user' | 'assistant'; content: string };
export default function AiSupport() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function send() {
    if (!draft.trim() || pending) return;
    const next: Message[] = [...messages, { role: 'user' as const, content: draft.trim().slice(0, 2000) }].slice(-15);
    setMessages(next); setDraft(''); setPending(true); setError('');
    try { const result = await api.post<{ reply: string }>('/ai-support/chat', { messages: next }); setMessages(v => [...v, { role: 'assistant', content: result.reply }]); }
    catch (e: any) { setError(e.message ?? 'Não foi possível enviar sua pergunta.'); }
    finally { setPending(false); }
  }
  return <View>
    <Title>Suporte FastDelivery</Title><Muted>Assistente virtual · respostas por inteligência artificial</Muted>
    <Card><Text style={{ color: theme.ink }}>Oi! Posso ajudar com dúvidas sobre o app, pedidos e entregas. Como posso ajudar?</Text></Card>
    {messages.map((m, i) => <Card key={i}><Text style={{ fontWeight: '800', color: m.role === 'user' ? theme.ink : theme.coral }}>{m.role === 'user' ? 'Você' : 'Assistente'}</Text><Text style={{ color: theme.ink, marginTop: 5 }}>{m.role === 'assistant' ? <SupportText text={m.content} /> : m.content}</Text></Card>)}
    {error ? <Text accessibilityRole="alert" style={{ color: '#b91c1c', marginBottom: 8 }}>{error}</Text> : null}
    <Input label="Sua pergunta" placeholder="Escreva sua dúvida aqui..." value={draft} onChangeText={setDraft} multiline />
    <Button onPress={send} loading={pending} disabled={!draft.trim()}>Enviar pergunta</Button>
    <Button variant="outline" disabled={pending} onPress={() => { setMessages([]); setDraft(''); setError(''); }}>Nova conversa</Button>
    <Muted>As mensagens são enviadas ao provedor de IA. Não informe senhas, dados de cartão, documentos ou outras informações sensíveis. A IA pode errar e não acessa nem altera seus pedidos.</Muted>
  </View>;
}
