import type { Request, Response, NextFunction } from 'express';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { forbidden, unauthorized } from './errors.js';
import { get, run, audit } from '../db/index.js';
import { now, uid } from './utils.js';
import type { Role } from '@myfood/shared';

const secret = new TextEncoder().encode(config.jwtSecret);

export interface AuthUser { id: string; role: Role; name: string; email: string; establishmentId?: string; courierId?: string }
declare global { namespace Express { interface Request { auth?: AuthUser } } }

export async function hashPassword(password: string) { return bcrypt.hash(password, 12); }
export async function verifyPassword(password: string, hash: string) { return bcrypt.compare(password, hash); }

export async function signToken(user: AuthUser): Promise<string> {
  return new SignJWT({ role: user.role, name: user.name, email: user.email })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(user.id).setIssuedAt().setExpirationTime(`${config.jwtTtlSeconds}s`)
    .setJti(uid()).sign(secret);
}

export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (!payload.sub || !payload.role) return null;
    const user = get<any>('SELECT id, name, email, role, status FROM users WHERE id=?', payload.sub);
    if (!user || user.status !== 'active') return null;
    const auth: AuthUser = { id: user.id, role: user.role, name: user.name, email: user.email };
    if (user.role === 'merchant') {
      const est = get<{ id: string }>('SELECT id FROM establishments WHERE owner_id=?', user.id);
      auth.establishmentId = est?.id;
    }
    if (user.role === 'courier') {
      const courier = get<{ id: string }>('SELECT id FROM couriers WHERE user_id=?', user.id);
      auth.courierId = courier?.id;
    }
    return auth;
  } catch { return null; }
}

export function bearer(req: Request): string | null {
  const h = req.headers.authorization;
  if (h?.startsWith('Bearer ')) return h.slice(7);
  if (typeof req.query.token === 'string') return req.query.token;
  return null;
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const token = bearer(req);
  if (!token) return next(unauthorized());
  const user = await verifyToken(token);
  if (!user) return next(unauthorized('Sessão inválida ou expirada'));
  req.auth = user;
  next();
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = bearer(req);
  if (token) req.auth = await verifyToken(token) ?? undefined;
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(unauthorized());
    if (!roles.includes(req.auth.role)) return next(forbidden('Seu perfil não possui acesso a este recurso'));
    next();
  };
}

export function loginGuard(req: Request) {
  const key = (req.body?.email ?? '').toString().toLowerCase().trim();
  const row = get<{ failures: number; locked_until: string | null }>('SELECT failures, locked_until FROM login_attempts WHERE key=?', key);
  if (row?.locked_until && new Date(row.locked_until) > new Date()) return false;
  return true;
}
export function loginFailed(req: Request) {
  const key = (req.body?.email ?? '').toString().toLowerCase().trim();
  const row = get<{ failures: number }>('SELECT failures FROM login_attempts WHERE key=?', key);
  const failures = (row?.failures ?? 0) + 1;
  const lock = failures >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
  run('INSERT INTO login_attempts (key,failures,locked_until,updated_at) VALUES (?,?,?,?) ON CONFLICT(key) DO UPDATE SET failures=excluded.failures, locked_until=excluded.locked_until, updated_at=excluded.updated_at',
    key, failures, lock, now());
  if (failures === 5) audit(null, null, 'login_lockout', 'user', key, { failures }, req.ip);
}
export function loginSuccess(req: Request) {
  run('DELETE FROM login_attempts WHERE key=?', (req.body?.email ?? '').toString().toLowerCase().trim());
}
