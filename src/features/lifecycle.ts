import { invoke } from '@tauri-apps/api/core';
import { flush, useSaveStatus } from '../db/saveQueue';
import { confirmDialog } from '../store/confirm';

/** Schreibt alles Ausstehende. Liefert false, wenn der Nutzer bei Speicherfehlern abbricht. */
export async function ensureSaved(): Promise<boolean> {
  await flush();
  if (useSaveStatus.getState().status !== 'error') return true;
  return confirmDialog({
    title: 'Nicht gespeicherte Änderungen',
    message:
      'Einige Änderungen konnten nicht gespeichert werden und gehen beim Beenden verloren. Die App versucht es weiter, solange sie geöffnet bleibt.',
    confirmLabel: 'Trotzdem beenden',
    danger: true,
  });
}

export async function quitApp(): Promise<void> {
  if (await ensureSaved()) await invoke('app_quit');
}
