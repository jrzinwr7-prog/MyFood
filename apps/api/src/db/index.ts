import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../core/config.js';
import { now, uid } from '../core/utils.js';

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
export const db = new DatabaseSync(config.dbPath);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
db.exec(fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));

export type Row = Record<string, any>;
export const all = <T = Row>(sql: string, ...params: any[]): T[] => db.prepare(sql).all(...params) as T[];
export const get = <T = Row>(sql: string, ...params: any[]): T | undefined => db.prepare(sql).get(...params) as T | undefined;
export const run = (sql: string, ...params: any[]) => db.prepare(sql).run(...params);

/** Transação ACID com suporte a chamadas aninhadas via SAVEPOINT. */
let depth = 0;
export function tx<T>(fn: () => T): T {
  const nested = depth > 0;
  const savepoint = `sp_${depth + 1}`;
  db.exec(nested ? `SAVEPOINT ${savepoint}` : 'BEGIN IMMEDIATE');
  depth++;
  try {
    const result = fn();
    db.exec(nested ? `RELEASE SAVEPOINT ${savepoint}` : 'COMMIT');
    return result;
  } catch (error) {
    db.exec(nested ? `ROLLBACK TO SAVEPOINT ${savepoint}` : 'ROLLBACK');
    throw error;
  } finally { depth--; }
}

export function audit(actorId: string | null, actorRole: string | null, action: string,
  targetType: string | null, targetId: string | null, metadata: unknown = {}, ip = '') {
  run('INSERT INTO audit_logs (id,actor_id,actor_role,action,target_type,target_id,metadata,ip,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
    uid(), actorId, actorRole, action, targetType, targetId, JSON.stringify(metadata ?? {}), ip, now());
}

export function setting<T>(key: string, fallback: T): T {
  const row = get<{ value: string }>('SELECT value FROM app_settings WHERE key=?', key);
  return row ? (JSON.parse(row.value) as T) : fallback;
}
export function setSetting(key: string, value: unknown) {
  run('INSERT INTO app_settings (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at',
    key, JSON.stringify(value), now());
}
