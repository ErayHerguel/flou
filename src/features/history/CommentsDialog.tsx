import { TextSelection } from '@tiptap/pm/state';
import { Check, MessageSquare } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Modal } from '../../components/Modal';
import { getActiveEditor } from '../../editor/active';
import type { CommentInfo } from '../../editor/nodes/comment';
import { useUI } from '../../store/ui';
import { formatCombo } from '../shortcuts/keys';

const format = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' });

/** Alle Kommentare der geöffneten Seite; Klick springt zur Stelle. */
export function CommentsDialog() {
  const editor = getActiveEditor();
  const [version, setVersion] = useState(0);
  const close = () => useUI.getState().setOverlay(null);

  const comments = useMemo(() => {
    const found = new Map<string, CommentInfo>();
    editor?.state.doc.descendants((node, pos) => {
      for (const mark of node.marks) {
        if (mark.type.name !== 'comment') continue;
        const id = String(mark.attrs.id);
        const existing = found.get(id);
        if (existing) {
          existing.to = pos + node.nodeSize;
          existing.quote += node.textContent;
        } else {
          found.set(id, { id, text: mark.attrs.text, createdAt: mark.attrs.createdAt, quote: node.textContent, from: pos, to: pos + node.nodeSize });
        }
      }
    });
    return [...found.values()];
    // version erzwingt Neuberechnung nach "Erledigt"
  }, [editor, version]);

  const jump = (c: CommentInfo) => {
    if (!editor) return;
    close();
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, c.from)).scrollIntoView());
    editor.view.focus();
  };

  const resolve = (c: CommentInfo) => {
    editor?.chain().setTextSelection({ from: c.from, to: c.to }).unsetMark('comment').run();
    setVersion((v) => v + 1);
  };

  return (
    <Modal onClose={close} className="flex max-h-[70vh] w-[520px] flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-semibold">
        <MessageSquare size={15} /> Kommentare
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        {comments.length === 0 && (
          <div className="px-3 py-6 text-center text-sm text-faint">Keine Kommentare. Text markieren und {formatCombo('Mod+Shift+M')} drücken.</div>
        )}
        {comments.map((c) => (
          <div key={c.id} className="group flex gap-2 rounded-md px-3 py-2 hover:bg-hover">
            <button onClick={() => jump(c)} className="min-w-0 flex-1 text-left">
              <div className="truncate text-xs text-faint">„{c.quote}“ · {c.createdAt ? format.format(c.createdAt) : ''}</div>
              <div className="text-sm whitespace-pre-wrap">{c.text}</div>
            </button>
            <button title="Erledigt" onClick={() => resolve(c)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted opacity-0 hover:bg-active group-hover:opacity-100">
              <Check size={14} />
            </button>
          </div>
        ))}
      </div>
    </Modal>
  );
}
