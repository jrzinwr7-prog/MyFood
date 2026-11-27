import type { Request, Response, NextFunction } from 'express';
import { bad } from './errors.js';

export const asyncRoute = (fn: (req: Request, res: Response, next: NextFunction) => unknown) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);

export function pagination(req: Request) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  return { page, limit, offset: (page - 1) * limit };
}
export function requireBody(req: Request, _res: Response, next: NextFunction) {
  if (!req.body || typeof req.body !== 'object') return next(bad('Corpo da requisição inválido'));
  next();
}
