import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Send, Store, Bike } from 'lucide-react';
import { api } from '../lib/api';
import { dt } from '../lib/format';
import { useRealtime } from '../lib/realtime';
import { useApp } from '../state/AppContext';
import { ConsumerShell } from '../components/Layout';
import { Button, EmptyState, Input, Spinner } from '../components/ui';

export default function Chat() {
  const { user, toast } = useApp();
  const [params] = useSearchParams();
  const [convs, setConvs] = useState<any[] | null>(null);
  const [active, setActive] = useState<string>(params.get('c') ?? '');
  const [messages, setMessages] = useState<any[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const loadConvs = useCallback(async () => {
    if (!user) return;
    try { const r = await api.get('/chat/conversations'); setConvs(r.items); if (!active && r.items[0]) setActive(r.items[0].id); }
    catch { setConvs([]); }
  }, [user?.id, active]);
  const loadMessages = useCallback(async () => {
    if (!active) return; setLoading(true);
    try { const r = await api.get(`/chat/conversations/${active}/messages`); setMessages(r.items); }
    catch (e: any) { toast(e.message, 'error'); } finally { setLoading(false); }
  }, [active]);
  useEffect(() => { loadConvs(); }, [user?.id]);
  useEffect(() => { loadMessages(); }, [loadMessages]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);
  useRealtime((event, data) => {
    if (event === 'message:new') {
      if (data.conversationId === active) setMessages(m => m.some(x => x.id === data.message.id) ? m : [...m, data.message]);
      loadConvs();
    }
    if (event === 'notification' && data?.type === 'chat:message') loadConvs();
  });

  async function send() {
    if (!body.trim()) return;
    try { const r = await api.post(`/chat/conversations/${active}/messages`, { body: body.trim() });
      setMessages(m => [...m, r.message]); setBody(''); loadConvs(); }
    catch (e: any) { toast(e.message, 'error'); }
  }
  if (!user) return <ConsumerShell><div className="p-6"><EmptyState title="Entre para conversar" text="Suas conversas com estabelecimentos e entregadores aparecem aqui."
    action={<Link to="/entrar"><Button>Entrar</Button></Link>} /></div></ConsumerShell>;

  const current = convs?.find(c => c.id === active);
  return <ConsumerShell>
    <div className="mb-5 flex items-center gap-2"><MessageCircle className="text-coral" size={22} /><h1 className="text-2xl font-black">Conversas</h1></div>
    <div className="grid h-[65vh] min-h-[480px] overflow-hidden rounded-3xl border border-line bg-white shadow-card md:grid-cols-[320px_1fr]">
      <div className={`border-r border-line ${active ? 'hidden md:block' : ''}`}>
        <div className="border-b border-line p-4 text-xs font-extrabold text-ink/50">Suas conversas</div>
        {convs === null ? <Spinner /> : convs.length === 0 ? <div className="p-6 text-center text-xs text-ink/50">Nenhuma conversa ainda. Elas são criadas automaticamente quando você faz um pedido.</div> :
          <div className="overflow-y-auto">{convs.map(c => <button key={c.id} onClick={() => setActive(c.id)} className={`flex w-full gap-3 border-b border-line p-4 text-left transition ${active === c.id ? 'bg-coral/5' : 'hover:bg-mist'}`}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-ink/5 text-coral">{c.type === 'customer_courier' ? <Bike size={18} /> : <Store size={18} />}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-xs font-extrabold">{c.establishment_name ?? 'Entrega'}</span>
              <span className="block truncate text-[11px] text-ink/50">{c.last_message ?? 'Pedido criado'}</span></span>
            {c.unread > 0 && <span className="grid h-5 w-5 place-items-center rounded-full bg-coral text-[10px] font-black text-white">{c.unread}</span>}
          </button>)}</div>}
      </div>
      <div className={`flex flex-col ${!active ? 'hidden md:flex' : 'flex'}`}>
        {!current ? <div className="grid h-full place-items-center text-sm text-ink/45">Selecione uma conversa</div> : <>
          <div className="flex items-center gap-3 border-b border-line p-3">
            <button onClick={() => setActive('')} className="rounded-xl bg-mist p-2 md:hidden"><ArrowLeft size={17} /></button>
            <div><p className="text-sm font-extrabold">{current.establishment_name ?? 'Entrega'}</p><p className="text-[11px] text-ink/45">Pedido #{current.order_id?.slice(-6).toUpperCase()} · {dt(current.created_at)}</p></div>
            <Link to={`/pedido/${current.order_id}`} className="ml-auto text-xs font-bold text-coral">Ver pedido</Link>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto bg-mist/50 p-4">
            {loading ? <Spinner /> : messages.length === 0 ? <p className="mt-8 text-center text-xs text-ink/45">Nenhuma mensagem. Envie a primeira!</p> : messages.map(m => <div key={m.id} className={`flex ${m.sender_id === user.id ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs shadow-card ${m.sender_id === user.id ? 'rounded-br-md bg-ink text-white' : 'rounded-bl-md bg-white'}`}>
                <p>{m.body}</p><p className={`mt-1 text-[9px] ${m.sender_id === user.id ? 'text-white/50' : 'text-ink/40'}`}>{dt(m.created_at)} {m.sender_id === user.id ? '· enviado' : ''}</p>
              </div></div>)}
            <div ref={bottom} />
          </div>
          <form onSubmit={e => { e.preventDefault(); send(); }} className="flex gap-2 border-t border-line p-3">
            <Input value={body} onChange={e => setBody(e.target.value)} placeholder="Escreva sua mensagem…" maxLength={2000} />
            <Button type="submit" className="shrink-0 px-4"><Send size={17} /></Button>
          </form>
        </>}
      </div>
    </div>
  </ConsumerShell>;
}
