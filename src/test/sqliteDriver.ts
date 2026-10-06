import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Driver, SqlValue } from '../db/driver';

const MIGRATIONS_DIR = join(__dirname, '../../src-tauri/migrations');

const toSql = (v: SqlValue) => (typeof v === 'boolean' ? Number(v) : v);

/** Echte SQLite-Datenbank im Speicher mit denselben Migrationen wie die App. */
export function createTestDriver(): Driver & { raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON');
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()) {
    raw.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
  }
  return {
    raw,
    async select<T>(sql: string, params: SqlValue[] = []) {
      return raw.prepare(sql).all(...params.map(toSql)) as T[];
    },
    async tx(statements) {
      raw.exec('BEGIN');
      try {
        for (const s of statements) raw.prepare(s.sql).run(...(s.params ?? []).map(toSql));
        raw.exec('COMMIT');
      } catch (err) {
        raw.exec('ROLLBACK');
        throw err;
      }
    },
  };
}
