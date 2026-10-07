import { Node } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';

export const Column = Node.create({
  name: 'column',
  content: 'block+',
  isolating: true,
  parseHTML: () => [{ tag: 'div[data-column]' }],
  renderHTML: () => ['div', { 'data-column': '', class: 'column' }, 0],
});

/** Zwei oder drei Spalten nebeneinander. */
export const Columns = Node.create({
  name: 'columns',
  group: 'block',
  content: 'column{2,3}',
  defining: true,
  parseHTML: () => [{ tag: 'div[data-columns]' }],
  renderHTML: () => ['div', { 'data-columns': '', class: 'columns' }, 0],

  addKeyboardShortcuts() {
    return {
      // Backspace am Anfang leerer Spalten: Spalten-Block durch einen Absatz ersetzen.
      Backspace: ({ editor }) => {
        const { $from, empty } = editor.state.selection;
        if (!empty || $from.parentOffset !== 0) return false;
        for (let d = $from.depth; d > 0; d--) {
          const node = $from.node(d);
          if (node.type.name !== 'columns') continue;
          if (node.textContent.trim() !== '') return false;
          let hasAtoms = false;
          node.descendants((n) => {
            if (n.isAtom && !n.isText) hasAtoms = true;
          });
          if (hasAtoms) return false;
          const start = $from.before(d);
          const tr = editor.state.tr.replaceWith(start, start + node.nodeSize, editor.schema.nodes.paragraph.create());
          tr.setSelection(TextSelection.create(tr.doc, start + 1));
          editor.view.dispatch(tr);
          return true;
        }
        return false;
      },
    };
  },
});

export const columnsContent = (count: 2 | 3) => ({
  type: 'columns',
  content: Array.from({ length: count }, () => ({ type: 'column', content: [{ type: 'paragraph' }] })),
});
