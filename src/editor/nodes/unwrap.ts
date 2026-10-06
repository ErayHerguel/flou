import type { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';

/**
 * Backspace am Anfang des ersten Absatzes eines Containers (Callout, Toggle):
 * der Container wird aufgelöst, sein Inhalt bleibt als normale Blöcke erhalten.
 */
export function unwrapAtStart(editor: Editor, typeName: string): boolean {
  const { state } = editor;
  const { selection } = state;
  if (!selection.empty) return false;
  const $from = selection.$from;
  if ($from.parentOffset !== 0 || $from.depth < 2) return false;
  const depth = $from.depth - 1;
  const wrapper = $from.node(depth);
  if (wrapper.type.name !== typeName || $from.index(depth) !== 0) return false;
  const start = $from.before(depth);
  const tr = state.tr.replaceWith(start, start + wrapper.nodeSize, wrapper.content);
  tr.setSelection(TextSelection.near(tr.doc.resolve(start + 1)));
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}
