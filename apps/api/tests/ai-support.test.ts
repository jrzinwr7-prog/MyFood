import { test } from 'node:test';
import assert from 'node:assert/strict';
import { askSupport, SUPPORT_MODEL, SUPPORT_SYSTEM_PROMPT } from '../src/modules/ai-support/service.js';

test('envia memória de sistema primeiro, histórico e modelo gratuito solicitado', async () => {
  let received: any;
  const mock: typeof fetch = async (input, init) => {
    assert.equal(String(input), 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer test-only');
    received = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ choices: [{ message: { content: 'Olá! Posso ajudar.' } }] }), { status: 200 });
  };
  const history = [{ role: 'user' as const, content: 'Como faço um pedido?' }, { role: 'assistant' as const, content: 'Escolha uma loja.' }, { role: 'user' as const, content: 'E depois?' }];
  assert.equal(await askSupport({ apiKey: 'test-only', messages: history, fetchImpl: mock }), 'Olá! Posso ajudar.');
  assert.equal(received.model, SUPPORT_MODEL);
  assert.deepEqual(received.messages, [{ role: 'system', content: SUPPORT_SYSTEM_PROMPT }, ...history]);
});

test('não consulta provedor sem chave e não repassa erro bruto do provedor', async () => {
  await assert.rejects(() => askSupport({ apiKey: '', messages: [] }), (e: any) => e.code === 'ai_not_configured');
  const mock: typeof fetch = async () => new Response('provider internal details', { status: 401 });
  await assert.rejects(() => askSupport({ apiKey: 'test-only', messages: [], fetchImpl: mock }), (e: any) => e.code === 'ai_provider_error' && !e.message.includes('provider internal details'));
});

test('resposta vazia e falha de rede são erros explícitos', async () => {
  const empty: typeof fetch = async () => new Response('{}', { status: 200 });
  const failing: typeof fetch = async () => { throw new Error('network sensitive details'); };
  await assert.rejects(() => askSupport({ apiKey: 'test-only', messages: [], fetchImpl: empty }), (e: any) => e.code === 'ai_invalid_response');
  await assert.rejects(() => askSupport({ apiKey: 'test-only', messages: [], fetchImpl: failing }), (e: any) => e.code === 'ai_unavailable' && !e.message.includes('network sensitive'));
});
