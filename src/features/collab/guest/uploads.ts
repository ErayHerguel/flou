import type { StoredFile } from '../../../lib/assets';

async function upload<T>(query: string, file: Blob): Promise<T> {
  const response = await fetch(`/api/upload?${query}`, { method: 'POST', body: file, credentials: 'same-origin' });
  if (!response.ok) throw new Error((await response.text()) || `Hochladen fehlgeschlagen (${response.status})`);
  return (await response.json()) as T;
}

/** Bild zum Gastgeber hochladen; liefert den Asset-Namen. */
export async function uploadImage(file: Blob, name: string): Promise<string> {
  const ext = name.includes('.') ? name.split('.').pop()! : (file.type.split('/')[1] ?? 'png');
  const { name: asset } = await upload<{ name: string }>(`kind=image&ext=${encodeURIComponent(ext.replace('+xml', ''))}`, file);
  return asset;
}

export function uploadFile(file: Blob, name: string): Promise<StoredFile> {
  return upload<StoredFile>(`kind=file&name=${encodeURIComponent(name)}`, file);
}

/** Dateiauswahl des Browsers. */
export function chooseFile(accept?: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (accept) input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}
