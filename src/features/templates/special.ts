import { setSetting } from '../../db/settings';
import type { Statement } from '../../db/driver';
import type { PageMeta } from '../../db/pages';
import { usePages } from '../../store/pages';

/** Seiten mit fester Aufgabe: Eingang (Schnellnotizen), Tagesnotizen und Vorlagen. */
export type Special = 'inbox' | 'daily' | 'templates';

const DEFAULTS: Record<Special, { title: string; icon: string }> = {
  inbox: { title: 'Eingang', icon: '📥' },
  daily: { title: 'Tagesnotizen', icon: '📅' },
  templates: { title: 'Vorlagen', icon: '📋' },
};

const settingKey = (kind: Special) => `special.${kind}`;
const known: Partial<Record<Special, string>> = {};

export function hydrateSpecial(settings: Record<string, string>): void {
  for (const kind of Object.keys(DEFAULTS) as Special[]) {
    const id = settings[settingKey(kind)];
    if (id) known[kind] = id;
  }
}

/** ID der Sonderseite, sofern sie existiert und nicht im Papierkorb liegt. */
export function specialId(kind: Special): string | null {
  const id = known[kind];
  const page = id ? usePages.getState().pages[id] : undefined;
  return page && page.deletedAt === null ? page.id : null;
}

/**
 * Liefert die Sonderseite und legt sie bei Bedarf an (ganz unten auf oberster Ebene).
 * `extra` läuft nur beim Anlegen mit, z. B. für mitgelieferte Vorlagen.
 */
export async function ensureSpecial(kind: Special, extra?: (page: PageMeta) => Statement[]): Promise<string> {
  const existing = specialId(kind);
  if (existing) return existing;
  const { title, icon } = DEFAULTS[kind];
  const id = await usePages.getState().create({ title, icon, extra: (page) => [setSetting(settingKey(kind), page.id), ...(extra?.(page) ?? [])] });
  known[kind] = id;
  return id;
}
