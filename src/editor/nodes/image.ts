import { Node } from '@tiptap/core';
import { assetUrl } from '../../lib/assets';
import { el } from '../dom';

/** Bild aus dem lokalen Asset-Ordner. `src` ist nur der Dateiname, nie eine URL. */
export const Image = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: '' },
      width: { default: null },
    };
  },

  parseHTML() {
    // Externe Bilder (http…) werden bewusst nicht übernommen: keine Netzwerkzugriffe.
    return [
      {
        tag: 'img[data-asset]',
        getAttrs: (element) => ({
          src: element.getAttribute('data-asset'),
          alt: element.getAttribute('alt') ?? '',
          width: Number(element.getAttribute('data-width')) || null,
        }),
      },
    ];
  },

  renderHTML({ node }) {
    return ['img', { 'data-asset': node.attrs.src, alt: node.attrs.alt, 'data-width': node.attrs.width ?? undefined }];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = el('figure', 'image-block');
      const frame = el('div', 'image-frame');
      const img = el('img');
      img.draggable = false;
      const handle = el('div', 'image-resize');
      frame.append(img, handle);
      dom.append(frame);

      const apply = (attrs: Record<string, unknown>) => {
        img.src = attrs.src ? assetUrl(String(attrs.src)) : '';
        img.alt = String(attrs.alt ?? '');
        frame.style.width = attrs.width ? `${attrs.width}%` : '';
      };
      apply(node.attrs);

      // Breite per Ziehen an der rechten Kante (in Prozent der Textbreite).
      handle.addEventListener('mousedown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const startX = event.clientX;
        const startWidth = frame.getBoundingClientRect().width;
        const full = dom.getBoundingClientRect().width;
        let width = node.attrs.width;
        const onMove = (e: MouseEvent) => {
          width = Math.round(Math.max(15, Math.min(100, ((startWidth + e.clientX - startX) / full) * 100)));
          frame.style.width = `${width}%`;
        };
        const onUp = () => {
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
          const pos = getPos();
          if (typeof pos === 'number') editor.view.dispatch(editor.state.tr.setNodeAttribute(pos, 'width', width));
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
      });

      return {
        dom,
        update: (updated) => {
          if (updated.type.name !== 'image') return false;
          node = updated;
          apply(updated.attrs);
          return true;
        },
        selectNode: () => dom.classList.add('is-selected'),
        deselectNode: () => dom.classList.remove('is-selected'),
        stopEvent: (event) => event.target === handle,
        ignoreMutation: () => true,
      };
    };
  },
});
