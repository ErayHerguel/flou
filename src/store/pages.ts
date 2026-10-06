import { create } from 'zustand';
import type { Statement } from '../db/driver';
import {
  deletePage,
  insertPage,
  loadPages,
  placePage,
  setDeleted,
  updatePage,
  type PageMeta,
  type PagePatch,
  type PageType,
} from '../db/pages';
import { commit, discard, schedule } from '../db/saveQueue';
import { newId } from '../lib/ids';
import {
  buildChildIndex,
  descendantIds,
  insertAt,
  isSelfOrDescendant,
  trashRoots,
  type ChildIndex,
  type PageMap,
} from '../lib/tree';
import { reportError } from './toast';

export interface CreateOptions {
  parentId?: string | null;
  type?: PageType;
  title?: string;
  icon?: string | null;
  index?: number;
  /** Zusätzliche Anweisungen, die in derselben Transaktion laufen (z. B. Inhalt oder Datenbank-Werte). */
  extra?: (page: PageMeta) => Statement[];
}

interface PagesState {
  pages: PageMap;
  children: ChildIndex;
  load(): Promise<void>;
  create(options?: CreateOptions): Promise<string>;
  update(id: string, patch: PagePatch): void;
  move(id: string, parentId: string | null, index: number): Promise<void>;
  trash(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  deleteForever(id: string): Promise<void>;
  emptyTrash(): Promise<void>;
}

/** Vergibt fortlaufende sort_order-Werte und liefert nur die nötigen UPDATEs. */
function reorder(pages: PageMap, parentId: string | null, ordered: string[]) {
  const next = { ...pages };
  const statements: Statement[] = [];
  ordered.forEach((id, sortOrder) => {
    const page = next[id];
    if (page.parentId === parentId && page.sortOrder === sortOrder) return;
    next[id] = { ...page, parentId, sortOrder };
    statements.push(placePage(id, parentId, sortOrder));
  });
  return { next, statements };
}

export const usePages = create<PagesState>((set, get) => {
  const apply = (pages: PageMap) => set({ pages, children: buildChildIndex(pages) });

  /** Optimistisch anwenden, dann transaktional schreiben; bei Fehler zurückrollen. */
  async function mutate(next: PageMap, statements: Statement[], context: string) {
    const previous = get().pages;
    apply(next);
    try {
      await commit(statements);
    } catch (err) {
      apply(previous);
      reportError(context, err);
      throw err;
    }
  }

  return {
    pages: {},
    children: new Map(),

    async load() {
      const list = await loadPages();
      apply(Object.fromEntries(list.map((p) => [p.id, p])));
    },

    async create({ parentId = null, type = 'page', title = '', icon = null, index, extra }: CreateOptions = {}) {
      const now = Date.now();
      const id = newId();
      const { pages, children } = get();
      const ordered = insertAt(children.get(parentId) ?? [], id, index ?? Number.MAX_SAFE_INTEGER);
      const page: PageMeta = {
        id,
        parentId,
        type,
        title,
        icon,
        cover: null,
        fullWidth: false,
        sortOrder: ordered.indexOf(id),
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      // Die neue Seite steht bereits an ihrer Position; reorder liefert nur Updates für verschobene Geschwister.
      const { next, statements } = reorder({ ...pages, [id]: page }, parentId, ordered);
      await mutate(next, [insertPage(page), ...statements, ...(extra?.(page) ?? [])], 'Seite anlegen');
      return id;
    },

    update(id, patch) {
      const page = get().pages[id];
      if (!page) return;
      apply({ ...get().pages, [id]: { ...page, ...patch, updatedAt: Date.now() } });
      schedule(`page:${id}`, () => {
        const current = get().pages[id];
        if (!current) return [];
        const { title, icon, cover, fullWidth } = current;
        return [updatePage(id, { title, icon, cover, fullWidth }, current.updatedAt)];
      });
    },

    async move(id, parentId, index) {
      const { pages, children } = get();
      if (!pages[id] || isSelfOrDescendant(pages, id, parentId)) return;
      if (parentId && pages[parentId]?.type === 'database' && pages[id].type === 'database') return;
      const siblings = children.get(parentId) ?? [];
      const { next, statements } = reorder(pages, parentId, insertAt(siblings, id, index));
      if (statements.length === 0) return;
      await mutate(next, statements, 'Seite verschieben');
    },

    async trash(id) {
      const { pages } = get();
      if (!pages[id]) return;
      const now = Date.now();
      const ids = [id, ...descendantIds(pages, id).filter((d) => pages[d].deletedAt === null)];
      const next = { ...pages };
      for (const d of ids) next[d] = { ...next[d], deletedAt: now };
      await mutate(next, setDeleted(ids, now), 'In den Papierkorb legen');
    },

    async restore(id) {
      const { pages, children } = get();
      const page = pages[id];
      if (!page || page.deletedAt === null) return;
      const ids = [id, ...descendantIds(pages, id).filter((d) => pages[d].deletedAt === page.deletedAt)];
      let next = { ...pages };
      for (const d of ids) next[d] = { ...next[d], deletedAt: null };
      const statements = setDeleted(ids, null);
      const parent = page.parentId ? pages[page.parentId] : undefined;
      if (page.parentId && (!parent || parent.deletedAt !== null)) {
        const roots = children.get(null) ?? [];
        const placed = reorder(next, null, [...roots, id]);
        next = placed.next;
        statements.push(...placed.statements);
      }
      await mutate(next, statements, 'Wiederherstellen');
    },

    async deleteForever(id) {
      const { pages } = get();
      if (!pages[id]) return;
      const ids = new Set([id, ...descendantIds(pages, id)]);
      discard((key) => ids.has(key.slice(key.indexOf(':') + 1)));
      const next = { ...pages };
      for (const d of ids) delete next[d];
      await mutate(next, [deletePage(id)], 'Endgültig löschen');
    },

    async emptyTrash() {
      const { pages } = get();
      const roots = trashRoots(pages);
      if (roots.length === 0) return;
      const doomed = new Set<string>();
      for (const root of roots) {
        doomed.add(root.id);
        for (const d of descendantIds(pages, root.id)) doomed.add(d);
      }
      discard((key) => doomed.has(key.slice(key.indexOf(':') + 1)));
      const next = { ...pages };
      for (const d of doomed) delete next[d];
      await mutate(next, roots.map((r) => deletePage(r.id)), 'Papierkorb leeren');
    },
  };
});
