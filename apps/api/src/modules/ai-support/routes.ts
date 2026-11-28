import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../core/auth.js';
import { asyncRoute } from '../../core/http.js';
import { HttpError, bad } from '../../core/errors.js';
import { askSupport } from './service.js';

export const aiSupportRouter = Router();
// Limite básico por usuário; não substitui proteção distribuída no servidor de produção.
const limits = new Map<string, { start: number; count: number }>();
const schema = z.object({ messages: z.array(z.object({
  role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(2000),
}).strict()).min(1).max(16) }).strict();
aiSupportRouter.post('/chat', authenticate, asyncRoute(async (req, res) => {
  const { messages } = schema.parse(req.body);
  if (messages.at(-1)?.role !== 'user') throw bad('A última mensagem deve ser sua pergunta.');
  if (messages.reduce((sum, item) => sum + item.content.length, 0) > 12000) throw bad('A conversa está longa demais. Inicie uma nova conversa.');
  if (!process.env.OPENROUTER_API_KEY) throw new HttpError(503, 'O assistente de IA ainda não está configurado. Use a central de ajuda.', 'ai_not_configured');
  const now = Date.now();
  for (const [id, bucket] of limits) if (now - bucket.start >= 600_000) limits.delete(id);
  const id = req.auth!.id; const bucket = limits.get(id) ?? { start: now, count: 0 };
  if (bucket.count >= 10) throw new HttpError(429, 'Você enviou muitas perguntas. Aguarde alguns minutos.', 'ai_rate_limited');
  bucket.count++; limits.set(id, bucket);
  const reply = await askSupport({ apiKey: process.env.OPENROUTER_API_KEY, messages });
  res.set('Cache-Control', 'no-store');
  res.json({ reply });
}));
