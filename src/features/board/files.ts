import type { BinaryFileData, BinaryFiles } from '@excalidraw/excalidraw/types';
import type { StoredScene } from '../../db/boards';
import { assetUrl, importImageBlob } from '../../lib/assets';

const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg' };

async function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Lädt die Bilder einer gespeicherten Szene aus dem Asset-Ordner. Fehlende Bilder werden übersprungen. */
export async function loadFiles(scene: StoredScene): Promise<BinaryFileData[]> {
  const entries = await Promise.all(
    Object.entries(scene.files).map(async ([id, file]) => {
      try {
        const blob = await (await fetch(assetUrl(file.asset))).blob();
        return { id, mimeType: file.mimeType, dataURL: await toDataUrl(blob), created: Date.now() } as BinaryFileData;
      } catch {
        return null;
      }
    }),
  );
  return entries.filter((e): e is BinaryFileData => e !== null);
}

/** Speichert neu hinzugekommene Bilder als Assets und liefert die ergänzte Zuordnung. */
export async function storeNewFiles(files: BinaryFiles, known: StoredScene['files']): Promise<StoredScene['files']> {
  const next = { ...known };
  for (const [id, file] of Object.entries(files)) {
    if (next[id]) continue;
    const blob = await (await fetch(file.dataURL)).blob();
    const asset = await importImageBlob(blob, `${id}.${EXT[file.mimeType] ?? 'png'}`);
    next[id] = { asset, mimeType: file.mimeType };
  }
  return next;
}
