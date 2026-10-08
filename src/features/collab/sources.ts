import type { Awareness } from 'y-protocols/awareness';
import type * as Y from 'yjs';
import { create } from 'zustand';
import type { Access } from './access';
import type { BoardFile, PointerTool } from './protocol';

/**
 * Woher Editor und Board ihre Inhalte beziehen, wenn gemeinsam gearbeitet wird:
 * beim Gastgeber aus dem Hub, beim Gast über die Verbindung. Ohne Quelle arbeiten beide lokal.
 */

export interface CollabUser {
  name: string;
  color: string;
}

export interface DocBinding {
  doc: Y.Doc;
  awareness: Awareness;
  user: CollabUser;
  release(): void;
}

export type BoardElement = Record<string, unknown> & { id: string; version: number; versionNonce: number };

export interface RemotePointer {
  person: string;
  name: string;
  color: string;
  x: number;
  y: number;
  tool: PointerTool;
  button: 'up' | 'down';
}

export interface BoardEvents {
  elements(elements: BoardElement[]): void;
  files(files: Record<string, BoardFile>): void;
  pointer(pointer: RemotePointer): void;
  leave(person: string): void;
}

export interface BoardBinding {
  snapshot: { elements: BoardElement[]; files: Record<string, BoardFile>; background: string };
  /** Geänderte Elemente der eigenen Ansicht */
  change(changed: BoardElement[], background: string): void;
  /** Bild speichern bzw. hochladen; liefert den Asset-Namen */
  storeImage(blob: Blob, name: string): Promise<string>;
  addFiles(files: Record<string, BoardFile>): void;
  pointer(x: number, y: number, tool: PointerTool, button: 'up' | 'down'): void;
  release(): void;
}

export type BoardSource = (pageId: string, events: BoardEvents) => Promise<BoardBinding>;

interface CollabState {
  docs: ((pageId: string) => Promise<DocBinding>) | null;
  boards: BoardSource | null;
  /** Wechselt, wenn geteilte Dokumente neu aufgebaut werden müssen (z. B. nach neuem Start des Gastgebers). */
  epoch: number;
}

export const useCollab = create<CollabState>(() => ({ docs: null, boards: null, epoch: 0 }));

/** Zugriff des Gastes pro Seite; null = eigener Workspace mit vollen Rechten. */
export const useAccess = create<{ access: Record<string, Access> | null }>(() => ({ access: null }));

export const canEdit = (pageId: string | null | undefined): boolean => {
  const { access } = useAccess.getState();
  return access === null || (pageId != null && access[pageId] === 'edit');
};

export const useCanEdit = (pageId: string | null | undefined): boolean =>
  useAccess((s) => s.access === null || (pageId != null && s.access[pageId] === 'edit'));
