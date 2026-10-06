import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

export interface AppPaths {
  dataDir: string;
  assetsDir: string;
  backupsDir: string;
}

let paths: AppPaths | null = null;

export async function initPaths(): Promise<AppPaths> {
  paths = await invoke<AppPaths>('app_paths');
  return paths;
}

function appPaths(): AppPaths {
  if (!paths) throw new Error('App-Pfade sind noch nicht geladen');
  return paths;
}

/** URL eines gespeicherten Bildes über das lokale asset:-Protokoll (kein Netzwerk). */
export function assetUrl(name: string): string {
  return convertFileSrc(`${appPaths().assetsDir}/${name}`);
}

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'bmp', 'heic'];

export function importImageFile(path: string): Promise<string> {
  return invoke<string>('asset_import_file', { path });
}

export async function importImageBlob(file: Blob, name: string): Promise<string> {
  const ext = name.includes('.') ? name.split('.').pop()! : (file.type.split('/')[1] ?? 'png');
  const bytes = new Uint8Array(await file.arrayBuffer());
  return invoke<string>('asset_import_bytes', bytes, { headers: { 'x-ext': ext.replace('+xml', '') } });
}

/** Öffnet den Dateidialog und importiert ein Bild. Liefert null bei Abbruch. */
export async function pickImage(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [{ name: 'Bilder', extensions: IMAGE_EXTENSIONS }],
  });
  if (typeof selected !== 'string') return null;
  return importImageFile(selected);
}

export function openExternal(url: string): Promise<void> {
  return invoke('open_external', { url });
}
