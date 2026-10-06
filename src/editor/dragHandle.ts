import { Extension, type Editor } from '@tiptap/core';
import type { Node as PMNode, ResolvedPos } from '@tiptap/pm/model';
import { NodeSelection, Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { el, icon } from './dom';

const LIST_ITEMS = new Set(['listItem', 'taskItem']);
const HANDLE_SIZE = 24;
/** Wie weit links vom Text der Mauszeiger noch als "über dem Block" gilt. */
const GUTTER = 64;

/** Tiefe des verschiebbaren Blocks an einer Position: innerster Listeneintrag oder oberste Ebene. */
function blockDepth($pos: ResolvedPos): number {
  for (let d = $pos.depth; d > 0; d--) if (LIST_ITEMS.has($pos.node(d).type.name)) return d;
  return Math.min(1, $pos.depth);
}

/** Startposition des Blocks unter dem Mauszeiger. */
function blockAt(view: EditorView, x: number, y: number): number | null {
  const rect = view.dom.getBoundingClientRect();
  const hit = view.posAtCoords({ left: Math.min(Math.max(x, rect.left + 4), rect.right - 4), top: y });
  if (!hit) return null;
  const { doc } = view.state;
  if (hit.inside >= 0) {
    const node = doc.nodeAt(hit.inside);
    if (node && LIST_ITEMS.has(node.type.name)) return hit.inside;
    const $inside = doc.resolve(hit.inside);
    if ($inside.depth === 0) return hit.inside;
    const depth = blockDepth($inside);
    return depth === 0 ? hit.inside : $inside.before(depth);
  }
  const $pos = doc.resolve(hit.pos);
  const depth = blockDepth($pos);
  return depth === 0 ? null : $pos.before(depth);
}

function placeHandle(view: EditorView, handle: HTMLElement, pos: number) {
  const dom = view.nodeDOM(pos);
  if (!(dom instanceof HTMLElement)) return false;
  const wrapper = handle.parentElement!.getBoundingClientRect();
  const isListItem = LIST_ITEMS.has(view.state.doc.nodeAt(pos)?.type.name ?? '');
  const firstLine = (dom.querySelector(':scope > p, :scope > div > p') as HTMLElement | null) ?? dom;
  const style = getComputedStyle(firstLine);
  const lineHeight = parseFloat(style.lineHeight) || HANDLE_SIZE;
  const paddingTop = parseFloat(style.paddingTop) || 0;
  const lineTop = firstLine.getBoundingClientRect().top;
  const top = lineTop - wrapper.top + paddingTop + (Math.min(lineHeight, 40) - HANDLE_SIZE) / 2;
  const left = dom.getBoundingClientRect().left - wrapper.left - handle.offsetWidth - (isListItem ? 22 : 4);
  handle.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  return true;
}

/** Verschiebt den Block mit dem Cursor um eine Position nach oben (-1) oder unten (+1). */
export function moveBlock(editor: Editor, dir: -1 | 1): boolean {
  const { state } = editor;
  const { selection } = state;
  const $from = selection.$from;
  const depth = blockDepth($from);
  if (depth === 0) return false;
  const parent = $from.node(depth - 1);
  const index = $from.index(depth - 1);
  const target = index + dir;
  if (target < 0 || target >= parent.childCount) return false;
  const node = $from.node(depth);
  const start = $from.before(depth);
  const end = $from.after(depth);
  const sibling: PMNode = parent.child(target);
  const tr = state.tr;
  let newStart: number;
  if (dir < 0) {
    newStart = start - sibling.nodeSize;
    tr.delete(start, end).insert(newStart, node);
  } else {
    tr.insert(end + sibling.nodeSize, node).delete(start, end);
    newStart = start + sibling.nodeSize;
  }
  const shift = newStart - start;
  tr.setSelection(
    selection instanceof NodeSelection
      ? NodeSelection.create(tr.doc, selection.from + shift)
      : TextSelection.create(tr.doc, selection.anchor + shift, selection.head + shift),
  );
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

/** Greifer und Plus-Knopf links neben jedem Block. */
export const DragHandle = Extension.create({
  name: 'dragHandle',

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-ArrowUp': ({ editor }) => moveBlock(editor, -1),
      'Mod-Shift-ArrowDown': ({ editor }) => moveBlock(editor, 1),
    };
  },

  addProseMirrorPlugins() {
    const editor = this.editor;
    let current: number | null = null;

    const handle = el('div', 'block-handle');
    const plus = el('button', 'block-handle-button');
    plus.type = 'button';
    plus.title = 'Klicken: Block darunter einfügen';
    plus.append(icon('plus', 16));
    const grip = el('div', 'block-handle-button');
    grip.draggable = true;
    grip.title = 'Ziehen: verschieben\nKlicken: auswählen';
    grip.append(icon('grip', 16));
    handle.append(plus, grip);

    const hide = () => {
      handle.classList.remove('is-visible');
      current = null;
    };

    let frame = 0;
    const onMouseMove = (event: MouseEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const view = editor.view;
        if (view.dragging || !editor.isEditable) return;
        if (handle.contains(event.target as Node)) return;
        const rect = view.dom.getBoundingClientRect();
        const inside =
          event.clientY >= rect.top && event.clientY <= rect.bottom && event.clientX >= rect.left - GUTTER && event.clientX <= rect.right;
        if (!inside) return hide();
        const pos = blockAt(view, event.clientX, event.clientY);
        if (pos === null || !placeHandle(view, handle, pos)) return hide();
        current = pos;
        handle.classList.add('is-visible');
      });
    };

    plus.addEventListener('mousedown', (e) => e.preventDefault());
    plus.addEventListener('click', () => {
      if (current === null) return;
      const $pos = editor.state.doc.resolve(current);
      const node = editor.state.doc.nodeAt(current);
      if (!node) return;
      const end = current + node.nodeSize;
      const inList = $pos.depth > 0 && LIST_ITEMS.has(node.type.name);
      const content = inList
        ? { type: node.type.name, content: [{ type: 'paragraph', content: [{ type: 'text', text: '/' }] }] }
        : { type: 'paragraph', content: [{ type: 'text', text: '/' }] };
      editor
        .chain()
        .insertContentAt(end, content)
        .setTextSelection(end + (inList ? 3 : 2))
        .focus()
        .run();
      hide();
    });

    grip.addEventListener('mousedown', (e) => e.stopPropagation());
    grip.addEventListener('click', () => {
      if (current === null) return;
      const view = editor.view;
      view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, current)));
      view.focus();
    });
    grip.addEventListener('dragstart', (event) => {
      if (current === null || !event.dataTransfer) return;
      const view = editor.view;
      const selection = NodeSelection.create(view.state.doc, current);
      view.dispatch(view.state.tr.setSelection(selection));
      const slice = selection.content();
      const { dom, text } = view.serializeForClipboard(slice);
      event.dataTransfer.clearData();
      event.dataTransfer.setData('text/html', dom.innerHTML);
      event.dataTransfer.setData('text/plain', text);
      event.dataTransfer.effectAllowed = 'copyMove';
      const blockDom = view.nodeDOM(current);
      if (blockDom instanceof HTMLElement) event.dataTransfer.setDragImage(blockDom, 0, 0);
      view.dragging = { slice, move: true };
    });
    grip.addEventListener('dragend', hide);

    return [
      new Plugin({
        key: new PluginKey('dragHandle'),
        view(view) {
          view.dom.parentElement?.append(handle);
          document.addEventListener('mousemove', onMouseMove);
          return {
            update(_, prev) {
              if (!prev.doc.eq(view.state.doc)) hide();
            },
            destroy() {
              cancelAnimationFrame(frame);
              document.removeEventListener('mousemove', onMouseMove);
              handle.remove();
            },
          };
        },
        props: {
          handleDOMEvents: {
            keydown: () => {
              hide();
              return false;
            },
            drop: () => {
              hide();
              return false;
            },
          },
        },
      }),
    ];
  },
});
