// @vitest-environment jsdom
import type { JSONContent } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { describe, expect, it } from 'vitest';
import { collectLinkTargets } from '../lib/doc';
import { createTestEditor, typeText } from '../test/editor';
import { docText } from './text';

/** Großes, gemischtes Dokument mit 2.000 Blöcken. */
function bigDoc(blocks = 2000): JSONContent {
  const content: JSONContent[] = [];
  for (let i = 0; i < blocks; i++) {
    const text = `Block ${i}: Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.`;
    if (i % 25 === 0) content.push({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] });
    else if (i % 10 === 0)
      content.push({ type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }] });
    else if (i % 7 === 0)
      content.push({ type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }] });
    else content.push({ type: 'paragraph', content: [{ type: 'text', text, marks: i % 3 === 0 ? [{ type: 'bold' }] : undefined }] });
  }
  return { type: 'doc', content };
}

describe('Performance mit 2.000 Blöcken', () => {
  it('tippt ohne spürbare Verzögerung', () => {
    const editor = createTestEditor(bigDoc());
    // Cursor in die Mitte setzen
    const middle = Math.floor(editor.state.doc.content.size / 2);
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.near(editor.state.doc.resolve(middle))));
    typeText(editor, 'warmup');

    const keystrokes = 300;
    const started = performance.now();
    typeText(editor, 'x'.repeat(keystrokes));
    const perKey = (performance.now() - started) / keystrokes;
    editor.destroy();
    // Ein Frame hat 16 ms; jsdom ist deutlich langsamer als WebKit.
    expect(perKey).toBeLessThan(8);
  });

  it('serialisiert für das Speichern schnell (läuft entkoppelt vom Tippen)', () => {
    const editor = createTestEditor(bigDoc());
    const started = performance.now();
    const json = editor.state.doc.toJSON();
    const text = docText(editor.state.doc, () => '');
    collectLinkTargets(json, 'x');
    const payload = JSON.stringify(json);
    const elapsed = performance.now() - started;
    editor.destroy();
    expect(text.length).toBeGreaterThan(100_000);
    expect(payload.length).toBeGreaterThan(100_000);
    expect(elapsed).toBeLessThan(100);
  });

  it('macht Änderungen über Blockgrenzen hinweg zuverlässig rückgängig', () => {
    const editor = createTestEditor(bigDoc(50));
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, editor.state.doc.child(0).nodeSize + 3)));
    // Referenz erst nach der ersten Transaktion: TrailingNode hängt dabei einen leeren Absatz an.
    const original = editor.state.doc;
    typeText(editor, 'eins');
    editor.commands.splitBlock();
    typeText(editor, 'zwei');
    // Auswahl über mehrere Blöcke löschen
    editor.commands.setTextSelection({ from: 5, to: 400 });
    editor.commands.deleteSelection();
    for (let i = 0; i < 20 && editor.can().undo(); i++) editor.commands.undo();
    expect(editor.state.doc.eq(original)).toBe(true);
    for (let i = 0; i < 20 && editor.can().redo(); i++) editor.commands.redo();
    expect(editor.state.doc.eq(original)).toBe(false);
    editor.destroy();
  });
});
