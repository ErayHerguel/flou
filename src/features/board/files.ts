import type { BinaryFileData } from '@excalidraw/excalidraw/types';
import { assetUrl } from '../../lib/assets';
import type { BoardFile } from '../collab/protocol';

async function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function toBlob(dataURL: string): Promise<Blob> {
  return (await fetch(dataURL)).blob();
}

/** Lädt die Bilder eines Boards (lokal aus dem Asset-Ordner, als Gast vom Gastgeber). Fehlende werden übersprungen. */
export async function loadFiles(files: Record<string, BoardFile>): Promise<BinaryFileData[]> {
  const entries = await Promise.all(
    Object.entries(files).map(async ([id, file]) => {
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
