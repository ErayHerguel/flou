import { Node } from '@tiptap/core';
import { useUI } from '../../store/ui';
import { bindPageChip, el } from '../dom';

/** Unterseite als eigener Block. Löschen des Blocks löscht die Seite nicht. */
export const PageRef = Node.create({
  name: 'pageRef',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return { pageId: { default: null } };
  },

  parseHTML() {
    return [{ tag: 'div[data-page-ref]', getAttrs: (element) => ({ pageId: element.getAttribute('data-page-ref') }) }];
  },

  renderHTML({ node }) {
    return ['div', { 'data-page-ref': node.attrs.pageId }];
  },

  addNodeView() {
    return ({ node }) => {
      let current = node;
      const dom = el('div', 'page-ref');
      const chip = el('button', 'page-chip');
      chip.type = 'button';
      chip.contentEditable = 'false';
      chip.addEventListener('click', () => useUI.getState().open(String(current.attrs.pageId)));
      dom.append(chip);
      const unbind = bindPageChip(chip, () => String(current.attrs.pageId));
      return {
        dom,
        update: (updated) => {
          if (updated.type.name !== 'pageRef' || updated.attrs.pageId !== current.attrs.pageId) return false;
          current = updated;
          return true;
        },
        selectNode: () => dom.classList.add('is-selected'),
        deselectNode: () => dom.classList.remove('is-selected'),
        ignoreMutation: () => true,
        destroy: unbind,
      };
    };
  },
});
