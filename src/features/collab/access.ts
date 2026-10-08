import type { PageMeta } from '../../db/pages';
import type { PageMap } from '../../lib/tree';

/** Gespeicherte Freigabe: 'none' nimmt einen Teilbaum wieder aus. */
export type Role = 'none' | 'read' | 'edit';
/** Tatsächlicher Zugriff auf eine Seite. */
export type Access = 'read' | 'edit';

export interface Grant {
  memberId: string;
  pageId: string;
  role: Role;
}

/** Seite aus Sicht eines Gastes: Seiten ohne sichtbare Elternseite stehen ganz oben. */
export interface GuestPage extends PageMeta {
  access: Access;
}

/**
 * Zugriff einer Person auf alle Seiten außerhalb des Papierkorbs. Es gilt die nächstgelegene Freigabe
 * (an der Seite selbst oder am nächsten Vorfahren); Datenbank-Einträge erben von ihrer Datenbank.
 */
export function accessMap(pages: PageMap, grants: ReadonlyMap<string, Role>): Map<string, Access> {
  const resolved = new Map<string, Role | null>();
  const resolve = (id: string): Role | null => {
    const chain: string[] = [];
    let current: string | null = id;
    let role: Role | null = null;
    while (current !== null) {
      const known = resolved.get(current);
      if (known !== undefined) {
        role = known;
        break;
      }
      if (chain.includes(current)) break;
      chain.push(current);
      const granted = grants.get(current);
      if (granted) {
        role = granted;
        break;
      }
      current = pages[current]?.parentId ?? null;
    }
    for (const c of chain) resolved.set(c, role);
    return role;
  };
  const result = new Map<string, Access>();
  for (const page of Object.values(pages)) {
    if (page.deletedAt !== null) continue;
    const role = resolve(page.id);
    if (role === 'read' || role === 'edit') result.set(page.id, role);
  }
  return result;
}

/** Freigaben einer Person als Nachschlagetabelle. */
export function grantsOf(grants: readonly Grant[], memberId: string): Map<string, Role> {
  return new Map(grants.filter((g) => g.memberId === memberId).map((g) => [g.pageId, g.role]));
}

/** Die für einen Gast sichtbaren Seiten. */
export function guestPages(pages: PageMap, access: ReadonlyMap<string, Access>): GuestPage[] {
  const result: GuestPage[] = [];
  for (const [id, level] of access) {
    const page = pages[id];
    if (!page) continue;
    const parentId = page.parentId && access.has(page.parentId) ? page.parentId : null;
    result.push({ ...page, parentId, access: level });
  }
  return result;
}

/** Woher kommt der Zugriff auf eine Seite? Für die Anzeige „über Elternseite …“. */
export function grantSource(pages: PageMap, grants: ReadonlyMap<string, Role>, pageId: string): { pageId: string; role: Role } | null {
  let current: string | null = pageId;
  const seen = new Set<string>();
  while (current !== null && !seen.has(current)) {
    seen.add(current);
    const role = grants.get(current);
    if (role) return { pageId: current, role };
    current = pages[current]?.parentId ?? null;
  }
  return null;
}
