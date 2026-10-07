import type { JSONContent } from '@tiptap/core';
import { db, type Statement } from './driver';

export async function loadDoc(pageId: string): Promise<JSONContent | null> {
  const rows = await db().select<{ doc: string }>('SELECT doc FROM page_content WHERE page_id = ?', [pageId]);
  if (rows.length === 0) return null;
  // Ein unlesbares Dokument wird nicht still überschrieben: der Fehler landet in der Oberfläche.
  return JSON.parse(rows[0].doc) as JSONContent;
}

/** Speichert Inhalt, Suchtext und ausgehende Links einer Seite. Existiert die Seite nicht mehr, passiert nichts. */
/** Höchstens eine Version pro Seite in diesem Abstand, höchstens MAX_VERSIONS je Seite. */
const VERSION_INTERVAL_MS = 10 * 60 * 1000;
const MAX_VERSIONS = 50;

export function saveContent(
  pageId: string,
  doc: JSONContent,
  text: string,
  linkTargets: string[],
  now: number,
): Statement[] {
  const json = JSON.stringify(doc);
  return [
    {
      sql: `INSERT INTO page_versions (page_id, created_at, doc, text)
            SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM pages WHERE id = ?)
            AND NOT EXISTS (SELECT 1 FROM page_versions WHERE page_id = ? AND created_at > ?)`,
      params: [pageId, now, json, text, pageId, pageId, now - VERSION_INTERVAL_MS],
    },
    {
      sql: `DELETE FROM page_versions WHERE page_id = ? AND id NOT IN
            (SELECT id FROM page_versions WHERE page_id = ? ORDER BY created_at DESC LIMIT ${MAX_VERSIONS})`,
      params: [pageId, pageId],
    },
    {
      sql: `INSERT INTO page_content (page_id, doc, text, updated_at)
            SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM pages WHERE id = ?)
            ON CONFLICT(page_id) DO UPDATE SET doc = excluded.doc, text = excluded.text, updated_at = excluded.updated_at`,
      params: [pageId, json, text, now, pageId],
    },
    { sql: 'UPDATE pages SET updated_at = ? WHERE id = ?', params: [now, pageId] },
    { sql: 'DELETE FROM page_links WHERE source_id = ?', params: [pageId] },
    ...linkTargets.map((target) => ({
      sql: `INSERT OR IGNORE INTO page_links (source_id, target_id)
            SELECT ?, id FROM pages WHERE id = ? AND EXISTS (SELECT 1 FROM pages WHERE id = ?)`,
      params: [pageId, target, pageId],
    })),
  ];
}

/** Inhalte mehrerer Seiten auf einmal (für den Export). Unlesbare Dokumente werden übersprungen. */
export async function loadDocs(pageIds: string[]): Promise<Record<string, JSONContent | null>> {
  const docs: Record<string, JSONContent | null> = {};
  for (let i = 0; i < pageIds.length; i += 500) {
    const chunk = pageIds.slice(i, i + 500);
    const rows = await db().select<{ page_id: string; doc: string }>(
      `SELECT page_id, doc FROM page_content WHERE page_id IN (${chunk.map(() => '?').join(', ')})`,
      chunk,
    );
    for (const row of rows) {
      try {
        docs[row.page_id] = JSON.parse(row.doc) as JSONContent;
      } catch {
        docs[row.page_id] = null;
      }
    }
  }
  return docs;
}

export interface VersionInfo {
  id: number;
  createdAt: number;
  text: string;
}

export async function listVersions(pageId: string): Promise<VersionInfo[]> {
  const rows = await db().select<{ id: number; created_at: number; text: string }>(
    'SELECT id, created_at, text FROM page_versions WHERE page_id = ? ORDER BY created_at DESC',
    [pageId],
  );
  return rows.map((r) => ({ id: Number(r.id), createdAt: Number(r.created_at), text: r.text }));
}

export async function loadVersion(id: number): Promise<JSONContent> {
  const [row] = await db().select<{ doc: string }>('SELECT doc FROM page_versions WHERE id = ?', [id]);
  if (!row) throw new Error('Version nicht gefunden');
  return JSON.parse(row.doc) as JSONContent;
}
