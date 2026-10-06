import type { Node as PMNode } from '@tiptap/pm/model';

/** Klartext eines Dokuments für Suche und Export-Vorschau. */
export function docText(doc: PMNode, titleOf: (pageId: string) => string): string {
  return doc.textBetween(0, doc.content.size, '\n', (leaf) => {
    if (leaf.type.name === 'pageLink' || leaf.type.name === 'pageRef') return titleOf(String(leaf.attrs.pageId));
    if (leaf.type.name === 'hardBreak') return '\n';
    return '';
  });
}
