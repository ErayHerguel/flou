import type { Editor, Range } from '@tiptap/core';
import { flush } from '../../db/saveQueue';
import { useUI } from '../../store/ui';

/**
 * Legt eine Unterseite (oder Datenbank) über `create` an, setzt einen Verweisblock an die Stelle
 * und öffnet die neue Seite.
 */
export async function createSubpageBlock(
  editor: Editor,
  range: Range,
  parentId: string,
  create: (parentId: string) => Promise<string>,
): Promise<void> {
  editor.chain().focus().deleteRange(range).run();
  const id = await create(parentId);
  if (!editor.isDestroyed) editor.chain().insertContent({ type: 'pageRef', attrs: { pageId: id } }).run();
  await flush();
  useUI.getState().setExpanded(parentId, true);
  useUI.getState().open(id);
  useUI.getState().requestFocus('title');
}
