import { db, type Statement } from './driver';

/** Gespeicherte Excalidraw-Szene. Bilder liegen im Asset-Ordner, hier steht nur der Verweis. */
export interface StoredScene {
  elements: readonly Record<string, unknown>[];
  files: Record<string, { asset: string; mimeType: string }>;
  appState?: { viewBackgroundColor?: string; scrollX?: number; scrollY?: number; zoom?: number };
}

export const emptyScene = (): StoredScene => ({ elements: [], files: {} });

export function insertBoard(pageId: string, now: number): Statement {
  return {
    sql: 'INSERT INTO boards (page_id, scene, updated_at) VALUES (?, ?, ?)',
    params: [pageId, JSON.stringify(emptyScene()), now],
  };
}

export async function loadBoard(pageId: string): Promise<StoredScene> {
  const [row] = await db().select<{ scene: string }>('SELECT scene FROM boards WHERE page_id = ?', [pageId]);
  if (!row) return emptyScene();
  return { ...emptyScene(), ...(JSON.parse(row.scene) as StoredScene) };
}

/** Speichert die Szene und macht ihre Texte durchsuchbar. */
export function saveBoard(pageId: string, scene: StoredScene, text: string, now: number): Statement[] {
  return [
    {
      sql: 'UPDATE boards SET scene = ?, updated_at = ? WHERE page_id = ?',
      params: [JSON.stringify(scene), now, pageId],
    },
    { sql: 'UPDATE pages SET updated_at = ? WHERE id = ?', params: [now, pageId] },
    {
      sql: 'UPDATE pages_fts SET body = ? WHERE rowid = (SELECT rid FROM pages WHERE id = ?)',
      params: [text, pageId],
    },
  ];
}

/** Alle Texte einer Szene (Textfelder, Beschriftungen von Sticky Notes und Formen). */
export function sceneText(elements: readonly Record<string, unknown>[]): string {
  return elements
    .filter((e) => !e.isDeleted && e.type === 'text' && typeof e.text === 'string')
    .map((e) => String(e.text).trim())
    .filter(Boolean)
    .join('\n');
}
