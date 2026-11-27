import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string, public code = 'error') { super(message); }
}
export const bad = (msg: string, code = 'bad_request') => new HttpError(400, msg, code);
export const unauthorized = (msg = 'Autenticação necessária') => new HttpError(401, msg, 'unauthorized');
export const forbidden = (msg = 'Sem permissão para esta operação') => new HttpError(403, msg, 'forbidden');
export const notFound = (msg = 'Recurso não encontrado') => new HttpError(404, msg, 'not_found');
export const conflict = (msg: string, code = 'conflict') => new HttpError(409, msg, code);

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Dados inválidos', code: 'validation_error',
      details: err.issues.map(i => ({ path: i.path.join('.'), message: i.message })) });
  }
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, code: err.code });
  if (err && typeof err === 'object' && 'code' in err && (err as any).code === 'SQLITE_CONSTRAINT_UNIQUE')
    return res.status(409).json({ error: 'Registro duplicado', code: 'conflict' });
  console.error('[ERROR]', req.method, req.path, err);
  return res.status(500).json({ error: 'Erro interno do servidor', code: 'internal_error' });
}
