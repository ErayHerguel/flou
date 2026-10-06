import { Node } from '@tiptap/core';
import { useUI } from '../../store/ui';
import { bindPageChip, el } from '../dom';

/** Inline-Verweis [[Seite]]. Der angezeigte Titel folgt immer dem aktuellen Seitentitel. */
export const PageLink = Node.create({
  name: 'pageLink',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return { pageId: { default: null } };
  },

  parseHTML() {
    return [{ tag: 'span[data-page-link]', getAttrs: (element) => ({ pageId: element.getAttribute('data-page-link') }) }];
  },

  renderHTML({ node }) {
    return ['span', { 'data-page-link': node.attrs.pageId }];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = el('span', 'page-link');
      dom.contentEditable = 'false';
      dom.addEventListener('click', () => useUI.getState().open(String(node.attrs.pageId)));
      const unbind = bindPageChip(dom, () => String(node.attrs.pageId), true);
      return {
        dom,
        update: (updated) => updated.type.name === 'pageLink' && updated.attrs.pageId === node.attrs.pageId,
        selectNode: () => dom.classList.add('is-selected'),
        deselectNode: () => dom.classList.remove('is-selected'),
        ignoreMutation: () => true,
        destroy: unbind,
      };
    };
  },
});
