import type { JSONContent } from '@tiptap/core';
import { fromAiMarkdown, toAiMarkdown } from '../markdown';

/**
 * Seiten bearbeiten mit KI: Die Seite geht als nummerierte Blöcke an Claude, zurück kommen nur
 * Änderungen (ersetzen, einfügen, löschen). So bleibt alles Unveränderte exakt erhalten, und
 * Blöcke, die Markdown nicht verlustfrei abbilden kann, sind geschützt.
 */

const PROTECTED: Record<string, string> = {
  image: 'Bild',
  file: 'Datei',
  databaseBlock: 'Datenbank',
  boardEmbed: 'Board',
  pageRef: 'Unterseite',
  columns: 'Spalten',
};

export interface PageBlock {
  index: number;
  /** Grund, warum der Block nicht verändert werden darf, sonst null */
  locked: string | null;
  markdown: string;
}

export type PageOpKind = 'replace' | 'insert_after' | 'insert_before' | 'delete';

export interface PageOp {
  op: PageOpKind;
  block: number;
  markdown: string;
}

export interface PageEditPlan {
  /** Titel, falls eine neue Seite entsteht */
  title: string;
  summary: string;
  ops: PageOp[];
}

const obj = (properties: Record<string, unknown>) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });

export const PAGE_EDIT_SCHEMA = obj({
  title: { type: 'string' },
  summary: { type: 'string' },
  ops: {
    type: 'array',
    items: obj({
      op: { type: 'string', enum: ['replace', 'insert_after', 'insert_before', 'delete'] },
      block: { type: 'integer' },
      markdown: { type: 'string' },
    }),
  },
});

function hasComment(node: JSONContent): boolean {
  if (node.marks?.some((m) => m.type === 'comment')) return true;
  return (node.content ?? []).some(hasComment);
}

/** Oberste Blöcke der Seite. Eine leere Seite hat genau einen leeren Absatz (Block 0). */
export function pageBlocks(doc: JSONContent): PageBlock[] {
  const nodes = doc.content?.length ? doc.content : [{ type: 'paragraph' }];
  return nodes.map((node, index) => ({
    index,
    locked: PROTECTED[node.type ?? ''] ?? (hasComment(node) ? 'Kommentar' : null),
    markdown: toAiMarkdown({ type: 'doc', content: [node] }),
  }));
}

export function serializeBlocks(blocks: PageBlock[]): string {
  return blocks
    .map((b) => `<block id="${b.index}"${b.locked ? ` geschuetzt="${b.locked}"` : ''}>\n${b.markdown}\n</block>`)
    .join('\n');
}

/** Verwirft unmögliche Änderungen: unbekannte Blöcke, Eingriffe in geschützte, doppelte Ersetzungen. */
export function validOps(ops: PageOp[], blocks: PageBlock[]): PageOp[] {
  const touched = new Set<number>();
  return ops.filter((op) => {
    const block = blocks[op.block];
    if (!block) return false;
    if (op.op === 'replace' || op.op === 'delete') {
      if (block.locked || touched.has(op.block)) return false;
      touched.add(op.block);
      if (op.op === 'replace' && !op.markdown.trim()) return false;
      return true;
    }
    return op.markdown.trim().length > 0;
  });
}

/** Neue oberste Knoten in Seitenreihenfolge für einen Block: davor, er selbst (oder Ersatz), danach. */
function planFor(index: number, node: JSONContent, ops: PageOp[]): JSONContent[] {
  const parse = fromAiMarkdown;
  const mine = ops.filter((o) => o.block === index);
  const out: JSONContent[] = [];
  for (const o of mine) if (o.op === 'insert_before') out.push(...parse(o.markdown));
  const replace = mine.find((o) => o.op === 'replace');
  if (replace) out.push(...parse(replace.markdown));
  else if (!mine.some((o) => o.op === 'delete')) out.push(node);
  for (const o of mine) if (o.op === 'insert_after') out.push(...parse(o.markdown));
  return out;
}

/** Wendet die Änderungen auf ein Dokument an (für neue Seiten und Tests). */
export function applyOps(doc: JSONContent, ops: PageOp[]): JSONContent {
  const nodes = doc.content?.length ? doc.content : [{ type: 'paragraph' }];
  const content = nodes.flatMap((node, i) => planFor(i, node, ops));
  // Ein leerer Absatz am Anfang einer neuen Seite bleibt nicht stehen, wenn Inhalt dazukommt.
  const cleaned = content.length > 1 ? content.filter((n, i) => !(i === 0 && isEmptyParagraph(n) && isEmptyParagraph(nodes[0]))) : content;
  return { type: 'doc', content: cleaned.length ? cleaned : [{ type: 'paragraph' }] };
}

export function isEmptyParagraph(node: JSONContent | undefined): boolean {
  return node?.type === 'paragraph' && !(node.content ?? []).length;
}

export interface PageChange {
  kind: 'changed' | 'added' | 'removed';
  before: string;
  after: string;
}

/** Für die Vorschau: was sich wo ändert. */
export function describeChanges(blocks: PageBlock[], ops: PageOp[]): PageChange[] {
  return ops.map((o) => ({
    kind: o.op === 'replace' ? 'changed' : o.op === 'delete' ? 'removed' : 'added',
    before: o.op === 'replace' || o.op === 'delete' ? (blocks[o.block]?.markdown ?? '') : '',
    after: o.op === 'delete' ? '' : o.markdown.trim(),
  }));
}
