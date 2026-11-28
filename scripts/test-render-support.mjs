// Verificação pontual com conta sintética, sem credenciais reais ou dados de pessoas.
import { randomUUID } from 'node:crypto';
const base = 'https://myfood-api-teste.onrender.com';
const headers = { 'Content-Type': 'application/json', 'Origin': 'https://jrzinwr7-prog.github.io' };
const preflight = await fetch(`${base}/api/ai-support/chat`, { method: 'OPTIONS', headers: { Origin: headers.Origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' }, signal: AbortSignal.timeout(120000) });
if (!preflight.ok || preflight.headers.get('access-control-allow-origin') !== headers.Origin) throw new Error('CORS da API não permite a origem do GitHub Pages.');
const register = await fetch(`${base}/api/auth/register`, { method: 'POST', headers, signal: AbortSignal.timeout(120000), body: JSON.stringify({ name: 'Teste Temporário', email: `teste-${randomUUID()}@example.invalid`, phone: '00000000000', password: randomUUID(), role: 'consumer', lgpdConsent: true }) });
if (!register.ok) throw new Error(`Cadastro sintético falhou: HTTP ${register.status}`);
const { token } = await register.json();
if (!token) throw new Error('API não retornou uma sessão de teste.');
console.log(`::add-mask::${token}`);
const result = await fetch(`${base}/api/ai-support/chat`, { method: 'POST', headers: { ...headers, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(120000), body: JSON.stringify({ messages: [{ role: 'user', content: 'Como faço um pedido no aplicativo?' }] }) });
const payload = await result.json().catch(() => ({}));
if (!result.ok || typeof payload.reply !== 'string' || !payload.reply.trim()) throw new Error(`Teste do assistente falhou: HTTP ${result.status}, código ${payload.code || 'desconhecido'}.`);
console.log('API respondeu ao teste do assistente com uma conta sintética.');
