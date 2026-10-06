import { db } from './driver';

/** Seiten, die auf `pageId` verlinken (ohne Papierkorb), zuletzt bearbeitete zuerst. */
export async function loadBacklinks(pageId: string): Promise<string[]> {
  const rows = await db().select<{ id: string }>(
    `SELECT p.id FROM page_links l JOIN pages p ON p.id = l.source_id
     WHERE l.target_id = ? AND p.deleted_at IS NULL ORDER BY p.updated_at DESC`,
    [pageId],
  );
  return rows.map((r) => r.id);
}
