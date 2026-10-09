import type { JSONContent } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { applyOps, describeChanges, pageBlocks, serializeBlocks, validOps, type PageOp } from './pageModel';

const p = (text: string): JSONContent => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const doc: JSONContent = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Ziele' }] },
    p('Erster Absatz'),
    { type: 'image', attrs: { src: 'abc.png', alt: 'Foto' } },
    { type: 'paragraph', content: [{ type: 'text', text: 'Mit Kommentar', marks: [{ type: 'comment', attrs: { id: 'c', text: 'x' } }] }] },
  ],
};

const texts = (d: JSONContent) => (d.content ?? []).map((n) => n.content?.map((c) => c.text).join('') ?? n.type);

describe('Seite als Blöcke', () => {
  it('nummeriert Blöcke und schützt Bilder und Kommentare', () => {
    const blocks = pageBlocks(doc);
    expect(blocks.map((b) => b.locked)).toEqual([null, null, 'Bild', 'Kommentar']);
    expect(blocks[0].markdown).toBe('## Ziele');
    expect(serializeBlocks(blocks)).toContain('<block id="2" geschuetzt="Bild">');
  });

  it('eine leere Seite hat einen Block 0', () => {
    expect(pageBlocks({ type: 'doc', content: [] })).toHaveLength(1);
  });

  it('verwirft Eingriffe in geschützte und unbekannte Blöcke', () => {
    const blocks = pageBlocks(doc);
    const ops: PageOp[] = [
      { op: 'replace', block: 2, markdown: 'weg' },
      { op: 'delete', block: 3, markdown: '' },
      { op: 'insert_after', block: 2, markdown: 'Bildunterschrift' },
      { op: 'replace', block: 9, markdown: 'x' },
      { op: 'replace', block: 1, markdown: 'Neu' },
      { op: 'replace', block: 1, markdown: 'Doppelt' },
    ];
    expect(validOps(ops, blocks)).toEqual([ops[2], ops[4]]);
  });

  it('ersetzt, fügt ein und löscht, Unverändertes bleibt gleich', () => {
    const ops: PageOp[] = [
      { op: 'insert_before', block: 0, markdown: '# Titel' },
      { op: 'replace', block: 1, markdown: '- a\n- b' },
      { op: 'insert_after', block: 3, markdown: 'Ende' },
    ];
    const out = applyOps(doc, ops);
    expect(out.content?.map((n) => n.type)).toEqual(['heading', 'heading', 'bulletList', 'image', 'paragraph', 'paragraph']);
    expect(out.content?.[3]).toBe(doc.content?.[2]);
    expect(texts(out).at(-1)).toBe('Ende');
    expect(describeChanges(pageBlocks(doc), ops).map((c) => c.kind)).toEqual(['added', 'changed', 'added']);
  });

  it('füllt eine leere Seite ohne leeren Absatz davor', () => {
    const empty = { type: 'doc', content: [{ type: 'paragraph' }] };
    const ops: PageOp[] = [{ op: 'insert_after', block: 0, markdown: '## A\n\nText' }];
    expect(applyOps(empty, ops).content?.map((n) => n.type)).toEqual(['heading', 'paragraph']);
  });

  it('Callouts aus „> 💡 Text“', () => {
    const out = applyOps({ type: 'doc', content: [{ type: 'paragraph' }] }, [{ op: 'replace', block: 0, markdown: '> 💡 Wichtig' }]);
    expect(out.content?.[0]).toMatchObject({ type: 'callout', attrs: { icon: '💡' } });
  });
});

