import { WORKSPACE_ID } from '../app.config';
import { db, type Statement } from './driver';

/** 'board' wird als Seite mit Eintrag in `boards` gespeichert (siehe Migration 005). */
export type PageType = 'page' | 'database' | 'board';

export interface PageMeta {
  id: string;
  parentId: string | null;
  type: PageType;
  title: string;
  icon: string | null;
  cover: string | null;
  fullWidth: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export type PagePatch = Partial<Pick<PageMeta, 'title' | 'icon' | 'cover' | 'fullWidth'>>;

interface PageRow {
  id: string;
  parent_id: string | null;
  type: PageType;
  title: string;
  icon: string | null;
  cover: string | null;
  full_width: number;
  sort_order: number;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

const toMeta = (r: PageRow): PageMeta => ({
  id: r.id,
  parentId: r.parent_id,
  type: r.type,
  title: r.title,
  icon: r.icon,
  cover: r.cover,
  fullWidth: Boolean(r.full_width),
  sortOrder: Number(r.sort_order),
  createdAt: Number(r.created_at),
  updatedAt: Number(r.updated_at),
  deletedAt: r.deleted_at === null ? null : Number(r.deleted_at),
});

/** Lädt alle Seiten inklusive Papierkorb. Inhalte werden erst beim Öffnen geladen. */
export async function loadPages(): Promise<PageMeta[]> {
  const rows = await db().select<PageRow>(
    `SELECT p.id, p.parent_id, CASE WHEN b.page_id IS NULL THEN p.type ELSE 'board' END AS type,
            p.title, p.icon, p.cover, p.full_width, p.sort_order, p.created_at, p.updated_at, p.deleted_at
     FROM pages p LEFT JOIN boards b ON b.page_id = p.id WHERE p.workspace_id = ?`,
    [WORKSPACE_ID],
  );
  return rows.map(toMeta);
}

export function insertPage(p: PageMeta): Statement {
  // Boards sind in der Tabelle pages normale Seiten; den Board-Eintrag legt insertBoard an.
  const storedType = p.type === 'board' ? 'page' : p.type;
  return {
    sql: `INSERT INTO pages (id, workspace_id, parent_id, type, title, icon, cover, full_width, sort_order, created_at, updated_at, deleted_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    params: [
      p.id, WORKSPACE_ID, p.parentId, storedType, p.title, p.icon, p.cover,
      p.fullWidth ? 1 : 0, p.sortOrder, p.createdAt, p.updatedAt, p.deletedAt,
    ],
  };
}

const PATCH_COLUMNS: Record<keyof PagePatch, string> = {
  title: 'title',
  icon: 'icon',
  cover: 'cover',
  fullWidth: 'full_width',
};

export function updatePage(id: string, patch: PagePatch, now: number): Statement {
  const keys = Object.keys(patch) as (keyof PagePatch)[];
  const sets = keys.map((k) => `${PATCH_COLUMNS[k]} = ?`);
  const values = keys.map((k) => {
    const v = patch[k];
    return typeof v === 'boolean' ? (v ? 1 : 0) : (v ?? null);
  });
  return {
    sql: `UPDATE pages SET ${[...sets, 'updated_at = ?'].join(', ')} WHERE id = ?`,
    params: [...values, now, id],
  };
}

export function placePage(id: string, parentId: string | null, sortOrder: number): Statement {
  return {
    sql: 'UPDATE pages SET parent_id = ?, sort_order = ? WHERE id = ?',
    params: [parentId, sortOrder, id],
  };
}

export function setDeleted(ids: string[], deletedAt: number | null): Statement[] {
  return ids.map((id) => ({
    sql: 'UPDATE pages SET deleted_at = ? WHERE id = ?',
    params: [deletedAt, id],
  }));
}

/** Endgültiges Löschen; Unterseiten, Inhalte und Links folgen per ON DELETE CASCADE. */
export function deletePage(id: string): Statement {
  return { sql: 'DELETE FROM pages WHERE id = ?', params: [id] };
}
