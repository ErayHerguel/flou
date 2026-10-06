import type { JSONContent } from '@tiptap/core';
import { db, type Statement } from './driver';

export async function loadDoc(pageId: string): Promise<JSONContent | null> {
  const rows = await db().select<{ doc: string }>('SELECT doc FROM page_content WHERE page_id = ?', [pageId]);
  if (rows.length === 0) return null;
  // Ein unlesbares Dokument wird nicht still überschrieben: der Fehler landet in der Oberfläche.
  return JSON.parse(rows[0].doc) as JSONContent;
}

/** Speichert Inhalt, Suchtext und ausgehende Links einer Seite. Existiert die Seite nicht mehr, passiert nichts. */
export function saveContent(
  pageId: string,
  doc: JSONContent,
  text: string,
  linkTargets: string[],
  now: number,
): Statement[] {
  return [
    {
      sql: `INSERT INTO page_content (page_id, doc, text, updated_at)
            SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM pages WHERE id = ?)
            ON CONFLICT(page_id) DO UPDATE SET doc = excluded.doc, text = excluded.text, updated_at = excluded.updated_at`,
      params: [pageId, JSON.stringify(doc), text, now, pageId],
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
