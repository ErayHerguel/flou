import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow, UserAttentionType } from '@tauri-apps/api/window';
import { create } from 'zustand';
import { db } from '../db/driver';
import { schedule } from '../db/saveQueue';
import { setSetting } from '../db/settings';
import { IS_MAC } from '../lib/platform';

/**
 * Erinnerungen an heute fällige Einträge (Datums-Properties mit „Am Tag erinnern“), ab 9 Uhr.
 * Im Fenster als Hinweis, dazu hüpft das Dock-Symbol einmal; unter Windows zusätzlich als Mitteilung
 * (macOS erlaubt Mitteilungen und Zahlen am Dock-Symbol nur Apps mit kostenpflichtiger Apple-Signatur).
 */

const HOUR = 9;
const CHECK_MS = 60_000;

export interface Due {
  pageId: string;
  propertyId: string;
  title: string;
  name: string;
}

interface RemindersState {
  due: Due[];
  /** Tag, an dem der Hinweis weggeklickt wurde */
  dismissed: string;
}

export const useReminders = create<RemindersState>(() => ({ due: [], dismissed: '' }));

export const ymd = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Heute fällige Einträge mit eingeschalteter Erinnerung (Werte sind als JSON gespeichert). */
export async function dueToday(today: string): Promise<Due[]> {
  return db().select<Due>(
    `SELECT v.page_id AS pageId, v.property_id AS propertyId, p.title AS title, dp.name AS name
     FROM db_values v
     JOIN db_properties dp ON dp.id = v.property_id
     JOIN pages p ON p.id = v.page_id
     WHERE dp.type = 'date' AND json_extract(dp.config, '$.remind') = 1 AND v.value = ? AND p.deleted_at IS NULL
     ORDER BY p.title`,
    [JSON.stringify(today)],
  );
}

/** Bereits gemeldete Erinnerungen des Tages (überlebt Neustarts, damit nichts doppelt kommt). */
let sent: { date: string; keys: string[] } = { date: '', keys: [] };
const keyOf = (d: Due) => `${d.pageId}:${d.propertyId}`;

async function check() {
  const now = new Date();
  const today = ymd(now);
  const due = now.getHours() >= HOUR ? await dueToday(today) : [];
  useReminders.setState({ due });

  if (sent.date !== today) sent = { date: today, keys: [] };
  const fresh = due.filter((d) => !sent.keys.includes(keyOf(d)));
  if (!fresh.length) return;
  sent = { date: today, keys: [...sent.keys, ...fresh.map(keyOf)] };
  schedule('setting:reminders.sent', () => [setSetting('reminders.sent', JSON.stringify(sent))]);
  if (useReminders.getState().dismissed === today) useReminders.setState({ dismissed: '' });
  await getCurrentWindow()
    .requestUserAttention(UserAttentionType.Informational)
    .catch(() => undefined);
  if (!IS_MAC) {
    const title = fresh.length === 1 ? `Heute fällig: ${fresh[0].title || 'Ohne Titel'}` : `${fresh.length} Einträge sind heute fällig`;
    await invoke('notify', { title, body: fresh.map((d) => d.title || 'Ohne Titel').join(', ') }).catch(() => undefined);
  }
}

/** Hinweis für heute ausblenden (die Erinnerungen bleiben in den Datenbanken sichtbar). */
export function dismissReminders(): void {
  useReminders.setState({ dismissed: ymd(new Date()) });
}

/** Startet die Prüfung (sofort und dann jede Minute). */
export function startReminders(settings: Record<string, string>): void {
  try {
    const stored = JSON.parse(settings['reminders.sent'] ?? '') as typeof sent;
    if (stored && typeof stored.date === 'string' && Array.isArray(stored.keys)) sent = stored;
  } catch {
    // noch nichts gemeldet
  }
  const run = () => void check().catch((err) => console.error('Erinnerungen', err));
  run();
  setInterval(run, CHECK_MS);
}
