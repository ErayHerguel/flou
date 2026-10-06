import { mergeAttributes, Node } from '@tiptap/core';
import { el } from '../dom';
import { unwrapAtStart } from './unwrap';

const CALLOUT_ICONS = ['💡', '⚠️', 'ℹ️', '✅', '❗', '📌', '🔥', '💬'];

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'paragraph+',
  defining: true,

  addAttributes() {
    return {
      icon: {
        default: CALLOUT_ICONS[0],
        parseHTML: (element) => element.getAttribute('data-icon') || CALLOUT_ICONS[0],
        renderHTML: (attrs) => ({ 'data-icon': attrs.icon }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-callout': '' }), 0];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = el('div', 'callout');
      const button = el('button', 'callout-icon');
      button.type = 'button';
      button.contentEditable = 'false';
      button.title = 'Icon wechseln';
      button.textContent = node.attrs.icon;
      button.addEventListener('mousedown', (e) => e.preventDefault());
      button.addEventListener('click', () => {
        const pos = getPos();
        const current = typeof pos === 'number' ? editor.state.doc.nodeAt(pos) : null;
        if (!current || !editor.isEditable) return;
        const next = CALLOUT_ICONS[(CALLOUT_ICONS.indexOf(current.attrs.icon) + 1) % CALLOUT_ICONS.length];
        editor.view.dispatch(editor.state.tr.setNodeAttribute(pos as number, 'icon', next));
      });
      const content = el('div', 'callout-content');
      dom.append(button, content);
      return {
        dom,
        contentDOM: content,
        update: (updated) => {
          if (updated.type.name !== 'callout') return false;
          button.textContent = updated.attrs.icon;
          return true;
        },
        ignoreMutation: (mutation) => button.contains(mutation.target),
      };
    };
  },

  addKeyboardShortcuts() {
    return { Backspace: () => unwrapAtStart(this.editor, this.name) };
  },
});
