import type { Editor } from '@tiptap/core';

/** Der Editor der aktuell geöffneten Seite, für Menü-Aktionen wie Undo/Redo. */
let active: Editor | null = null;

export function setActiveEditor(editor: Editor | null): void {
  active = editor;
}

export function getActiveEditor(): Editor | null {
  return active && !active.isDestroyed ? active : null;
}
