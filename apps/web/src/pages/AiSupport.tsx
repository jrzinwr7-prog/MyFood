import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp, Bot, LifeBuoy, MessageCircle, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react';
import { ConsumerShell } from '../components/Layout';
import { api, VISUAL_PREVIEW } from '../lib/api';
import { useApp } from '../state/AppContext';

type Message = { role: 'user' | 'assistant'; content: string };
const suggestions = ['Como faço um pedido?', 'Como funciona o pagamento?', 'Como me torno entregador?'];

export default function AiSupport() {
  const { user } = useApp();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function send(text: string) {
    const question = text.trim();
    if (!question || pending || VISUAL_PREVIEW || !user) return;
    const next: Message[] = [...messages, { role: 'user' as const, content: question }].slice(-15);
    setMessages(next); setDraft(''); setPending(true); setError('');
    try {
      const result = await api.post<{ reply: string }>('/ai-support/chat', { messages: next });
      setMessages(prev => [...prev, { role: 'assistant', content: result.reply }]);
    } catch (e: any) { setError(e.message || 'Não foi possível enviar. Tente novamente.'); }
    finally { setPending(false); }
  }
  const submit = (event: FormEvent) => { event.preventDefault(); void send(draft); };
  return <ConsumerShell><div className="mx-auto max-w-3xl">
    <div className="mb-6 flex items-center gap-3"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-coral text-white shadow-lg shadow-coral/20"><Bot size={28}/></div>
      <div><p className="text-[11px] font-black uppercase tracking-[.18em] text-coral">Estamos aqui por você</p><h1 className="text-2xl font-black sm:text-3xl">Suporte MyFood</h1><p className="text-xs text-ink/50">Uma ajudinha para suas dúvidas sobre o app.</p></div></div>
    {VISUAL_PREVIEW && <div role="status" className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">Esta é uma prévia visual. O assistente ainda não está conectado à API e não responde aqui.</div>}
    {!VISUAL_PREVIEW && !user && <div className="mb-4 rounded-2xl border border-line bg-white p-4 text-sm text-ink/70">Para usar o assistente, <Link to="/entrar" className="font-bold text-coral underline">entre na sua conta</Link>.</div>}
    <div className="overflow-hidden rounded-[1.8rem] border border-line bg-white shadow-card">
      <div className="flex items-center gap-3 border-b border-line px-5 py-4"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-coral/10 text-coral"><Sparkles size={19}/></div><div><p className="text-sm font-extrabold">Assistente virtual</p><p className="text-[11px] text-ink/45">Respostas por inteligência artificial</p></div>
        <button type="button" onClick={() => { setMessages([]); setError(''); setDraft(''); }} disabled={pending} className="ml-auto flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold text-ink/50 hover:bg-mist disabled:opacity-40" aria-label="Limpar conversa"><RotateCcw size={14}/> Nova conversa</button></div>
      <div className="min-h-[280px] max-h-[50vh] space-y-4 overflow-y-auto bg-gradient-to-b from-mist/70 to-white p-4 sm:p-6" aria-live="polite">
        <div className="flex items-start gap-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-coral text-white"><Bot size={17}/></span><div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white p-4 text-sm leading-relaxed text-ink/75 shadow-sm">Oi! 👋 Sou o assistente virtual do MyFood. Posso ajudar com dúvidas sobre pedidos, entregas e o funcionamento do app. Como posso ajudar?</div></div>
        {messages.map((m, i) => <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${m.role === 'user' ? 'rounded-tr-sm bg-ink text-white' : 'rounded-tl-sm bg-white text-ink/75 shadow-sm'}`}>{m.content}</div></div>)}
        {pending && <p className="text-xs font-semibold text-ink/50">Assistente está pensando…</p>}
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{error} Sua pergunta continua na conversa; você pode tentar novamente.</p>}
        {!messages.length && <div className="flex flex-wrap gap-2">{suggestions.map(q => <button key={q} type="button" onClick={() => setDraft(q)} className="rounded-full border border-line bg-white px-3 py-2 text-xs font-bold text-ink/60 hover:border-coral hover:text-coral">{q}</button>)}</div>}
      </div>
      <form onSubmit={submit} className="flex items-end gap-2 border-t border-line p-4"><label className="sr-only" htmlFor="support-message">Sua pergunta</label><textarea id="support-message" rows={2} maxLength={2000} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Escreva sua dúvida aqui..." className="max-h-28 min-h-[50px] flex-1 resize-y rounded-2xl border border-line bg-mist px-4 py-3 text-sm outline-none focus:border-coral"/><button type="submit" disabled={pending || !draft.trim() || VISUAL_PREVIEW || !user} aria-label="Enviar mensagem" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-coral text-white disabled:cursor-not-allowed disabled:opacity-40"><ArrowUp size={20}/></button></form>
      <p className="px-5 pb-4 text-[11px] leading-relaxed text-ink/45"><ShieldCheck size={13} className="mr-1 inline"/>Suas mensagens são enviadas ao provedor de IA. Não informe senhas, cartões, documentos ou dados sensíveis. A IA pode errar e não acessa pedidos nem faz alterações.</p>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2"><Link to="/ajuda" className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4 text-sm font-bold hover:border-coral"><LifeBuoy size={19} className="text-coral"/> Ver perguntas frequentes</Link><Link to="/perfil?tab=ajuda" className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4 text-sm font-bold hover:border-coral"><MessageCircle size={19} className="text-coral"/> Abrir chamado no perfil</Link></div>
  </div></ConsumerShell>;
}
