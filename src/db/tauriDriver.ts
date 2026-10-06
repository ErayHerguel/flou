import Database from '@tauri-apps/plugin-sql';
import { invoke } from '@tauri-apps/api/core';
import { DB_URL } from '../app.config';
import type { Driver } from './driver';

/** Lesen über tauri-plugin-sql (führt beim Laden die Migrationen aus), Schreiben über den Rust-Command db_tx. */
export async function createTauriDriver(): Promise<Driver> {
  const conn = await Database.load(DB_URL);
  return {
    select: (sql, params = []) => conn.select(sql, params),
    tx: (statements) =>
      invoke('db_tx', {
        statements: statements.map((s) => ({ sql: s.sql, params: s.params ?? [] })),
      }),
  };
}
