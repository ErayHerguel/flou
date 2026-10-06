import { db, type Statement } from './driver';

export async function loadSettings(): Promise<Record<string, string>> {
  const rows = await db().select<{ key: string; value: string }>('SELECT key, value FROM settings');
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export function setSetting(key: string, value: string): Statement {
  return {
    sql: 'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    params: [key, value],
  };
}
