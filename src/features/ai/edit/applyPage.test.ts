// @vitest-environment jsdom
import type { JSONContent } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { createTestEditor } from '../../../test/editor';
import { applyPageOps } from './applyPage';

const p = (text: string): JSONContent => ({ type: 'paragraph', content: [{ type: 'text', text }] });
describe('Anwenden im Editor', () => {
  it('ändert nur betroffene Blöcke, in einem Schritt', () => {
    const editor = createTestEditor({ type: 'doc', content: [p('Eins'), p('Zwei'), p('Drei')] });
    const snapshot = editor.state.doc;
    const ok = applyPageOps(editor, snapshot, [
      { op: 'replace', block: 1, markdown: '## Zwei neu' },
      { op: 'insert_after', block: 2, markdown: '- [ ] Aufgabe' },
      { op: 'delete', block: 0, markdown: '' },
      { op: 'insert_before', block: 0, markdown: 'Anfang' },
    ]);
    expect(ok).toBe(true);
    // Der Editor hängt nach einer Liste selbst einen leeren Absatz an.
    expect(editor.getJSON().content?.map((n) => n.type).slice(0, 4)).toEqual(['paragraph', 'heading', 'paragraph', 'taskList']);
    expect(editor.state.doc.textContent).toBe('AnfangZwei neuDreiAufgabe');
    editor.commands.undo();
    expect(editor.state.doc.eq(snapshot)).toBe(true);
  });

  it('lehnt ab, wenn die Seite inzwischen geändert wurde', () => {
    const editor = createTestEditor({ type: 'doc', content: [p('Eins')] });
    const snapshot = editor.state.doc;
    editor.commands.insertContentAt(1, 'X');
    expect(applyPageOps(editor, snapshot, [{ op: 'delete', block: 0, markdown: '' }])).toBe(false);
  });

  it('füllt eine leere Seite', () => {
    const editor = createTestEditor({ type: 'doc', content: [{ type: 'paragraph' }] });
    applyPageOps(editor, editor.state.doc, [{ op: 'replace', block: 0, markdown: '# Titel\n\nText' }]);
    expect(editor.getJSON().content?.map((n) => n.type)).toEqual(['heading', 'paragraph']);
  });
});
