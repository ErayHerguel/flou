import { db } from './driver';

export interface SearchHit {
  id: string;
  /** Ausschnitt mit Markierungen: \u0001 = Beginn, \u0002 = Ende eines Treffers */
  snippet: string;
}

export const MARK_START = '\u0001';
export const MARK_END = '\u0002';

/** Wandelt Nutzereingabe in eine sichere FTS5-Abfrage: jedes Wort als Präfix, UND-verknüpft. */
export function toFtsQuery(input: string): string | null {
  const tokens = input.toLocaleLowerCase('de').match(/[\p{L}\p{N}]+/gu);
  if (!tokens?.length) return null;
  return tokens.map((t) => `"${t}"*`).join(' ');
}

/** Volltextsuche über Titel (stärker gewichtet) und Inhalt aller Seiten außerhalb des Papierkorbs. */
export async function searchPages(input: string, limit = 30): Promise<SearchHit[]> {
  const query = toFtsQuery(input);
  if (!query) return [];
  return db().select<SearchHit>(
    `SELECT p.id AS id, snippet(pages_fts, 1, ?, ?, '…', 14) AS snippet
     FROM pages_fts JOIN pages p ON p.rid = pages_fts.rowid
     WHERE pages_fts MATCH ? AND p.deleted_at IS NULL
     ORDER BY bm25(pages_fts, 8.0, 1.0)
     LIMIT ?`,
    [MARK_START, MARK_END, query, limit],
  );
}
