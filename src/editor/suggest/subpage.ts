import type { Editor, Range } from '@tiptap/core';
import type { PageType } from '../../db/pages';
import { flush } from '../../db/saveQueue';
import { usePages } from '../../store/pages';
import { useUI } from '../../store/ui';

/** Legt eine Unterseite an, setzt einen Verweisblock an die Stelle und öffnet die neue Seite. */
export async function createSubpageBlock(editor: Editor, range: Range, parentId: string, type: PageType): Promise<void> {
  editor.chain().focus().deleteRange(range).run();
  const id = await usePages.getState().create({ parentId, type });
  if (!editor.isDestroyed) editor.chain().insertContent({ type: 'pageRef', attrs: { pageId: id } }).run();
  await flush();
  useUI.getState().setExpanded(parentId, true);
  useUI.getState().open(id);
  useUI.getState().requestFocus('title');
}
