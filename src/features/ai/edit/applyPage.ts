import type { Editor, JSONContent } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { fromAiMarkdown } from '../markdown';
import { isEmptyParagraph, type PageOp } from './pageModel';

/**
 * Wendet Claudes Änderungen im Editor an: eine Transaktion, also ein ⌘Z. Blöcke werden von hinten
 * nach vorn bearbeitet, damit die Positionen der vorderen gültig bleiben. Unveränderte Blöcke
 * (auch Datenbanken und Boards) werden nicht angefasst.
 * Liefert false, wenn die Seite seit der Anfrage verändert wurde.
 */
export function applyPageOps(editor: Editor, snapshot: PMNode, ops: PageOp[]): boolean {
  const { state } = editor;
  if (!state.doc.eq(snapshot)) return false;
  const nodes = (json: JSONContent[]) => json.map((n) => state.schema.nodeFromJSON(n));
  const parse = (op: PageOp) => nodes(fromAiMarkdown(op.markdown));
  const starts: number[] = [];
  snapshot.forEach((_node, offset) => starts.push(offset));
  const tr = state.tr;
  const onlyEmpty = snapshot.childCount === 1 && isEmptyParagraph(snapshot.child(0).toJSON() as JSONContent);

  const indices = [...new Set(ops.map((o) => o.block))].filter((i) => i < snapshot.childCount).sort((a, b) => b - a);
  for (const index of indices) {
    const from = starts[index];
    const to = from + snapshot.child(index).nodeSize;
    const mine = ops.filter((o) => o.block === index);
    const after = mine.filter((o) => o.op === 'insert_after').flatMap(parse);
    const before = mine.filter((o) => o.op === 'insert_before').flatMap(parse);
    const replace = mine.find((o) => o.op === 'replace');
    const remove = mine.some((o) => o.op === 'delete') || (onlyEmpty && (after.length > 0 || before.length > 0));
    if (after.length) tr.insert(to, after);
    if (replace) tr.replaceWith(from, to, parse(replace));
    else if (remove) tr.delete(from, to);
    if (before.length) tr.insert(from, before);
  }
  // Ein Dokument braucht mindestens einen Block.
  if (tr.doc.childCount === 0) tr.insert(0, state.schema.nodes.paragraph.create());
  if (!tr.docChanged) return true;
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}
