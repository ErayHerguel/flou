import { Editor, type JSONContent } from '@tiptap/core';
import { createExtensions } from '../editor/extensions';

/** jsdom kennt keine Layout-APIs; ProseMirror braucht sie für scrollIntoView und Koordinaten. */
function polyfillLayout() {
  const rect = { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) };
  const rects = Object.assign([rect], { item: () => rect }) as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => rect as DOMRect;
  Range.prototype.getClientRects = () => rects;
  Element.prototype.getClientRects = () => rects;
  Element.prototype.scrollIntoView = () => undefined;
  document.elementFromPoint = () => null;
}

export function createTestEditor(content: JSONContent | string, pageId = 'page-under-test'): Editor {
  polyfillLayout();
  const element = document.createElement('div');
  document.body.append(element);
  return new Editor({ element, extensions: createExtensions(pageId), content });
}

/** Tippt Text Zeichen für Zeichen, sodass Eingaberegeln (Markdown-Shortcuts) greifen. */
export function typeText(editor: Editor, text: string): void {
  for (const ch of text) {
    const { from, to } = editor.state.selection;
    const handled = editor.view.someProp('handleTextInput', (f) => f(editor.view, from, to, ch, () => editor.state.tr.insertText(ch, from, to)));
    if (!handled) editor.view.dispatch(editor.state.tr.insertText(ch, from, to));
  }
}

export const p = (text?: string): JSONContent => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] });

export function topLevelTypes(editor: Editor): string[] {
  const types: string[] = [];
  editor.state.doc.forEach((node) => types.push(node.type.name));
  return types;
}

export function textOf(editor: Editor): string[] {
  const texts: string[] = [];
  editor.state.doc.forEach((node) => texts.push(node.textContent));
  return texts;
}

/** Echter keydown auf dem Editor, wie bei einer Tastatureingabe. */
export function pressKey(editor: Editor, key: string, modifiers: KeyboardEventInit = {}): void {
  editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...modifiers }));
}
