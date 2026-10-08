import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { GUEST } from './mode';

/** Speichert eine Datei: in der App über den Sichern-Dialog, im Browser als Download. Liefert false bei Abbruch. */
export async function saveBlob(blob: Blob, filename: string, filter: { name: string; extensions: string[] }): Promise<boolean> {
  if (GUEST) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return true;
  }
  const path = await save({ defaultPath: filename, filters: [filter] });
  if (!path) return false;
  await invoke('save_file', new Uint8Array(await blob.arrayBuffer()), { headers: { 'x-path': encodeURIComponent(path) } });
  return true;
}
