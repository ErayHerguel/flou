// @vitest-environment jsdom
import { TextSelection } from '@tiptap/pm/state';
import { afterEach, describe, expect, it } from 'vitest';
import type { Editor } from '@tiptap/core';
import { collectLinkTargets } from '../lib/doc';
import { createTestEditor, p, pressKey, textOf, topLevelTypes, typeText } from '../test/editor';
import { moveBlock } from './dragHandle';
import { SLASH_ITEMS } from './suggest/slashItems';
import { docText } from './text';

let editor: Editor;
afterEach(() => editor?.destroy());

/** Setzt den Cursor an das Ende des n-ten Textblocks (0-basiert). */
function cursorInBlock(index: number, atStart = false) {
  let count = -1;
  let target = 0;
  editor.state.doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    count += 1;
    if (count === index) target = atStart ? pos + 1 : pos + 1 + node.content.size;
    return false;
  });
  editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, target)));
}

describe('Markdown-Shortcuts', () => {
  const cases: [string, string][] = [
    ['# ', 'heading'],
    ['- ', 'bulletList'],
    ['1. ', 'orderedList'],
    ['[] ', 'taskList'],
    ['> ', 'blockquote'],
    ['``` ', 'codeBlock'],
  ];
  for (const [input, type] of cases) {
    it(`„${input.trim()}“ wird zu ${type}`, () => {
      editor = createTestEditor({ type: 'doc', content: [p()] });
      cursorInBlock(0);
      typeText(editor, input);
      expect(topLevelTypes(editor)[0]).toBe(type);
    });
  }

  it('erkennt ## als Überschrift 2', () => {
    editor = createTestEditor({ type: 'doc', content: [p()] });
    cursorInBlock(0);
    typeText(editor, '## Titel');
    expect(editor.state.doc.firstChild?.attrs.level).toBe(2);
    expect(editor.state.doc.firstChild?.textContent).toBe('Titel');
  });
});

describe('Blöcke verschieben', () => {
  it('verschiebt Absätze nach oben und unten und behält den Cursor', () => {
    editor = createTestEditor({ type: 'doc', content: [p('A'), p('B'), p('C')] });
    cursorInBlock(1);
    expect(moveBlock(editor, -1)).toBe(true);
    expect(textOf(editor)).toEqual(['B', 'A', 'C']);
    expect(editor.state.selection.$from.parent.textContent).toBe('B');
    expect(moveBlock(editor, -1)).toBe(false);
    moveBlock(editor, 1);
    moveBlock(editor, 1);
    expect(textOf(editor)).toEqual(['A', 'C', 'B']);
  });

  it('verschiebt Listeneinträge innerhalb der Liste', () => {
    editor = createTestEditor('<ul><li><p>eins</p></li><li><p>zwei</p></li></ul>');
    cursorInBlock(1);
    moveBlock(editor, -1);
    const items: string[] = [];
    editor.state.doc.firstChild?.forEach((li) => items.push(li.textContent));
    expect(items).toEqual(['zwei', 'eins']);
  });

  it('macht das Verschieben mit einem Undo rückgängig', () => {
    editor = createTestEditor({ type: 'doc', content: [p('A'), p('B')] });
    cursorInBlock(1);
    moveBlock(editor, -1);
    editor.commands.undo();
    expect(textOf(editor)).toEqual(['A', 'B']);
  });
});

describe('Toggle und Callout', () => {
  const toggleDoc = (open: boolean) => ({
    type: 'doc',
    // Absatz am Ende, damit TrailingNode keinen zusätzlichen Absatz anhängt.
    content: [{ type: 'toggle', attrs: { open }, content: [p('Kopf'), p('Inhalt')] }, p('Danach')],
  });

  it('Enter im Kopf eines zugeklappten Toggles legt einen Block darunter an', () => {
    editor = createTestEditor(toggleDoc(false));
    cursorInBlock(0);
    pressKey(editor, 'Enter');
    expect(textOf(editor)).toEqual(['KopfInhalt', '', 'Danach']);
    expect(editor.state.doc.firstChild?.childCount).toBe(2);
    expect(editor.state.selection.$from.parent.textContent).toBe('');
    expect(editor.state.selection.$from.depth).toBe(1);
  });

  it('Enter im Kopf eines offenen Toggles bleibt im Toggle', () => {
    editor = createTestEditor(toggleDoc(true));
    cursorInBlock(0);
    pressKey(editor, 'Enter');
    expect(topLevelTypes(editor)).toEqual(['toggle', 'paragraph']);
    expect(editor.state.doc.firstChild?.childCount).toBe(3);
  });

  it('Backspace am Anfang löst Toggle und Callout auf, ohne Inhalt zu verlieren', () => {
    editor = createTestEditor(toggleDoc(true));
    cursorInBlock(0, true);
    pressKey(editor, 'Backspace');
    expect(textOf(editor)).toEqual(['Kopf', 'Inhalt', 'Danach']);
    editor.destroy();

    editor = createTestEditor({ type: 'doc', content: [{ type: 'callout', content: [p('Hinweis')] }, p('Danach')] });
    cursorInBlock(0, true);
    pressKey(editor, 'Backspace');
    expect(topLevelTypes(editor)).toEqual(['paragraph', 'paragraph']);
    expect(textOf(editor)).toEqual(['Hinweis', 'Danach']);
  });
});

describe('Slash-Befehle', () => {
  const run = (id: string) => {
    const item = SLASH_ITEMS.find((i) => i.id === id)!;
    const { from } = editor.state.selection;
    item.run(editor, { from: from - 1, to: from }, { pageId: 'x' });
  };

  for (const [id, type] of [
    ['h2', 'heading'],
    ['todo', 'taskList'],
    ['toggle', 'toggle'],
    ['callout', 'callout'],
    ['quote', 'blockquote'],
    ['code', 'codeBlock'],
    ['bullet', 'bulletList'],
  ] as const) {
    it(`/${id} erzeugt ${type} und entfernt das Slash-Zeichen`, () => {
      editor = createTestEditor({ type: 'doc', content: [p('Text/')] });
      cursorInBlock(0);
      run(id);
      expect(topLevelTypes(editor)[0]).toBe(type);
      expect(editor.state.doc.textContent).toBe('Text');
    });
  }

  it('/divider fügt einen Trenner ein', () => {
    editor = createTestEditor({ type: 'doc', content: [p('/')] });
    cursorInBlock(0);
    run('divider');
    expect(topLevelTypes(editor)).toContain('horizontalRule');
  });
});

describe('Seitenlinks', () => {
  it('extrahiert Linkziele und Suchtext', () => {
    editor = createTestEditor({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Siehe ' },
            { type: 'pageLink', attrs: { pageId: 'ziel' } },
            { type: 'pageLink', attrs: { pageId: 'page-under-test' } },
          ],
        },
        { type: 'pageRef', attrs: { pageId: 'kind' } },
      ],
    });
    const json = editor.getJSON();
    expect(collectLinkTargets(json, 'page-under-test')).toEqual(['ziel']);
    expect(docText(editor.state.doc, (id) => (id === 'ziel' ? 'Zielseite' : 'Kindseite'))).toBe('Siehe ZielseiteKindseite\nKindseite');
  });

  it('übernimmt beim Einfügen keine externen Bilder', () => {
    editor = createTestEditor('<p>a</p><img src="https://example.com/x.png"><p>b</p>');
    expect(topLevelTypes(editor)).not.toContain('image');
  });
});
