import { Node } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { ArrowUpRight } from 'lucide-react';
import { PageIcon, pageTitle } from '../../components/PageIcon';
import { DatabaseView } from '../../features/database/DatabaseView';
import { usePages } from '../../store/pages';
import { useUI } from '../../store/ui';
import { isDropEvent } from '../dom';

function DatabaseBlockView({ node }: NodeViewProps) {
  const id = String(node.attrs.databaseId);
  const page = usePages((s) => s.pages[id]);
  return (
    <NodeViewWrapper className="database-block" contentEditable={false} data-drag-handle>
      {!page || page.deletedAt !== null ? (
        <div className="rounded-md border border-dashed border-border-strong px-4 py-3 text-sm text-faint">Datenbank im Papierkorb oder gelöscht</div>
      ) : (
        <>
          <button onClick={() => useUI.getState().open(id)} className="group flex items-center gap-2 rounded-md px-1 py-0.5 text-left text-lg font-semibold hover:bg-hover">
            <PageIcon page={page} size={18} />
            {pageTitle(page)}
            <ArrowUpRight size={14} className="text-faint opacity-0 group-hover:opacity-100" />
          </button>
          <DatabaseView databaseId={id} />
        </>
      )}
    </NodeViewWrapper>
  );
}

/** Datenbank direkt im Seiteninhalt (die Datenbank selbst bleibt eine Unterseite). */
export const DatabaseBlock = Node.create({
  name: 'databaseBlock',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return { databaseId: { default: null } };
  },

  parseHTML() {
    return [{ tag: 'div[data-database]', getAttrs: (e) => ({ databaseId: e.getAttribute('data-database') }) }];
  },

  renderHTML({ node }) {
    return ['div', { 'data-database': node.attrs.databaseId }];
  },

  addNodeView() {
    // Ereignisse innerhalb der Datenbank gehören der Datenbank, nicht dem Editor.
    return ReactNodeViewRenderer(DatabaseBlockView, { stopEvent: ({ event }) => !isDropEvent(event) });
  },
});
