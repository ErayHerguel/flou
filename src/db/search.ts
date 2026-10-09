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

/** Volltextsuche über Titel (stärker gewichtet), Inhalt und Datenbank-Werte aller Seiten außerhalb des Papierkorbs. */
export async function searchPages(input: string, limit = 30): Promise<SearchHit[]> {
  const query = toFtsQuery(input);
  if (!query) return [];
  return db().select<SearchHit>(
    `SELECT p.id AS id, snippet(pages_fts, -1, ?, ?, '…', 14) AS snippet
     FROM pages_fts JOIN pages p ON p.rid = pages_fts.rowid
     WHERE pages_fts MATCH ? AND p.deleted_at IS NULL
     ORDER BY bm25(pages_fts, 8.0, 1.0, 2.0)
     LIMIT ?`,
    [MARK_START, MARK_END, query, limit],
  );
}

/** Wörter, die bei Fragen nichts über das Thema sagen. */
const STOPWORDS = new Set(
  'der die das den dem des ein eine einer eines einem einen und oder aber nicht kein keine ist sind war waren wird werden wurde hat haben hatte ich du er sie es wir ihr mein dein sein unser euer was wie wo wann warum wer welche welcher welches mit von zu zum zur für auf aus bei nach über unter vor im in am an als auch noch schon nur sehr mehr kann können soll sollte muss gibt habe hast mir mich dir dich uns the and for with what how why when where which who about this that'.split(' '),
);

/** Suche für Fragen in natürlicher Sprache: bedeutungstragende Wörter, ODER-verknüpft, nach Relevanz. */
export async function searchRelevant(question: string, limit = 8): Promise<string[]> {
  const tokens = [...new Set(question.toLocaleLowerCase('de').match(/[\p{L}\p{N}]+/gu) ?? [])].filter(
    (t) => t.length >= 3 && !STOPWORDS.has(t),
  );
  if (!tokens.length) return [];
  const rows = await db().select<{ id: string }>(
    `SELECT p.id AS id FROM pages_fts JOIN pages p ON p.rid = pages_fts.rowid
     WHERE pages_fts MATCH ? AND p.deleted_at IS NULL
     ORDER BY bm25(pages_fts, 8.0, 1.0, 2.0)
     LIMIT ?`,
    [tokens.map((t) => `"${t}"*`).join(' OR '), limit],
  );
  return rows.map((r) => r.id);
}
