import type { JSONContent } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { EditorContent, useEditor } from '@tiptap/react';
import { useEffect, useMemo, useState } from 'react';
import { loadDoc, saveContent } from '../db/content';
import { flush, schedule } from '../db/saveQueue';
import { collectLinkTargets } from '../lib/doc';
import { usePages } from '../store/pages';
import { useUI } from '../store/ui';
import { setActiveEditor } from './active';
import { createExtensions } from './extensions';
import { docText } from './text';
import { CommentBubble, TableMenu, Toolbar } from './Toolbar';

type LoadState = { status: 'loading' } | { status: 'ready'; doc: JSONContent | null } | { status: 'error'; message: string };

const titleOf = (id: string) => usePages.getState().pages[id]?.title ?? '';

/** Plant das Speichern. Das PM-Dokument ist unveränderlich, daher ist die Momentaufnahme gratis. */
function scheduleSave(pageId: string, doc: PMNode) {
  schedule(`content:${pageId}`, () => {
    const json = doc.toJSON() as JSONContent;
    return saveContent(pageId, json, docText(doc, titleOf), collectLinkTargets(json, pageId), Date.now());
  });
}

export function Editor({ pageId }: { pageId: string }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    loadDoc(pageId)
      .then((doc) => alive && setState({ status: 'ready', doc }))
      .catch((err) => alive && setState({ status: 'error', message: String(err) }));
    return () => {
      alive = false;
    };
  }, [pageId]);

  if (state.status === 'loading') return null;
  if (state.status === 'error') {
    return (
      <div className="rounded-md border border-danger px-4 py-3 text-sm text-danger">
        Der Inhalt dieser Seite konnte nicht geladen werden. Er wurde nicht verändert. ({state.message})
      </div>
    );
  }
  return <LoadedEditor pageId={pageId} initial={state.doc} />;
}

function LoadedEditor({ pageId, initial }: { pageId: string; initial: JSONContent | null }) {
  const extensions = useMemo(() => createExtensions(pageId), [pageId]);
  const editor = useEditor({
    extensions,
    content: initial,
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
    editorProps: { attributes: { class: 'flou-editor', spellcheck: 'true' } },
    onUpdate: ({ editor: e }) => scheduleSave(pageId, e.state.doc),
  });

  useEffect(() => {
    setActiveEditor(editor);
    return () => {
      setActiveEditor(null);
      void flush();
    };
  }, [editor]);

  const pendingFocus = useUI((s) => s.pendingFocus);
  useEffect(() => {
    if (useUI.getState().consumeFocus(pageId, 'editor')) editor.commands.focus('start');
  }, [pendingFocus, pageId, editor]);

  return (
    <>
      <EditorContent editor={editor} className="relative" />
      <Toolbar editor={editor} />
      <CommentBubble editor={editor} />
      <TableMenu editor={editor} />
    </>
  );
}
