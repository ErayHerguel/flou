import { Node } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { ArrowUpRight } from 'lucide-react';
import { PageIcon, pageTitle } from '../../components/PageIcon';
import { BoardPreview } from '../../features/board/BoardPreview';
import { usePages } from '../../store/pages';
import { useUI } from '../../store/ui';

function BoardEmbedView({ node }: NodeViewProps) {
  const id = String(node.attrs.pageId);
  const page = usePages((s) => s.pages[id]);
  const missing = !page || page.deletedAt !== null;
  return (
    <NodeViewWrapper className="board-embed" contentEditable={false} data-drag-handle>
      <button onClick={() => !missing && useUI.getState().open(id)} className="board-embed-head" disabled={missing}>
        {page && <PageIcon page={page} size={15} />}
        <span>{missing ? 'Board im Papierkorb oder gelöscht' : pageTitle(page)}</span>
        {!missing && <ArrowUpRight size={13} className="board-embed-arrow" />}
      </button>
      {!missing && (
        <div className="board-embed-body" onDoubleClick={() => useUI.getState().open(id)}>
          <BoardPreview pageId={id} />
        </div>
      )}
    </NodeViewWrapper>
  );
}

/** Eingebettetes Board mit Vorschau; Doppelklick öffnet es. */
export const BoardEmbed = Node.create({
  name: 'boardEmbed',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes: () => ({ pageId: { default: null } }),
  parseHTML: () => [{ tag: 'div[data-board]', getAttrs: (e) => ({ pageId: (e as HTMLElement).getAttribute('data-board') }) }],
  renderHTML: ({ node }) => ['div', { 'data-board': node.attrs.pageId }],
  addNodeView() {
    return ReactNodeViewRenderer(BoardEmbedView, { stopEvent: () => true });
  },
});
