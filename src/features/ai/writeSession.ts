import type { Editor, JSONContent } from '@tiptap/core';
import type { Transaction } from '@tiptap/pm/state';
import { create } from 'zustand';
import { usePages } from '../../store/pages';
import { useUI } from '../../store/ui';
import { AiCancelled, askAi, type AiRequest } from './client';
import { asInsertable, cleanAnswer, fromAiMarkdown, pageMarkdown, rangeMarkdown } from './markdown';
import { modelInfo } from './models';
import { pageRequest, rewriteRequest, type WriteAction } from './write';

/** Wo das Ergebnis landet */
export type Target = 'replace' | 'cursor' | 'top' | 'end';

export interface WriteSession {
  id: number;
  action: WriteAction;
  target: Target;
  status: 'preparing' | 'running' | 'done' | 'error';
  text: string;
  model: string | null;
  cost: number | null;
  error: string | null;
}

export const useWrite = create<{ session: WriteSession | null }>(() => ({ session: null }));

let current: {
  id: number;
  editor: Editor;
  from: number;
  to: number;
  controller: AbortController;
  request: AiRequest;
  off: () => void;
} | null = null;
let nextId = 1;

const update = (id: number, patch: Partial<WriteSession>) =>
  useWrite.setState((s) => (s.session?.id === id ? { session: { ...s.session, ...patch } } : s));

function end(): void {
  current?.controller.abort();
  current?.off();
  current = null;
  useWrite.setState({ session: null });
}

/** Startet eine Schreibhilfe-Aktion im Editor. Ergebnis erscheint als Vorschau im Panel. */
export function startWrite(editor: Editor, action: WriteAction, instruction = ''): void {
  end();
  const { from, to, empty } = editor.state.selection;
  const pageId = useUI.getState().currentId;
  const title = (pageId && usePages.getState().pages[pageId]?.title) || 'Ohne Titel';
  let target: Target;
  let request: AiRequest;
  let start = from;
  let stop = to;
  if (action === 'summarize' || action === 'tasks') {
    target = action === 'summarize' ? 'top' : 'end';
    request = pageRequest(action, pageMarkdown(editor), title);
  } else if (action === 'continue') {
    target = 'cursor';
    stop = start;
    const size = editor.state.doc.content.size;
    const before = rangeMarkdown(editor, 0, from);
    const after = rangeMarkdown(editor, from, size);
    request = pageRequest('continue', `${before}\n<weiter/>\n${after}`.trim(), title);
  } else {
    if (empty) return;
    target = 'replace';
    request = rewriteRequest(action, rangeMarkdown(editor, from, to), instruction);
  }
  const id = nextId++;
  const controller = new AbortController();
  // Positionen mitführen, falls während der Antwort weitergetippt wird.
  const onTransaction = ({ transaction }: { transaction: Transaction }) => {
    if (!current || current.id !== id || !transaction.docChanged) return;
    current.from = transaction.mapping.map(current.from, -1);
    current.to = transaction.mapping.map(current.to, 1);
  };
  editor.on('transaction', onTransaction);
  current = { id, editor, from: start, to: stop, controller, request, off: () => editor.off('transaction', onTransaction) };
  useWrite.setState({ session: { id, action, target, status: 'preparing', text: '', model: null, cost: null, error: null } });
  void execute(id, request, controller);
}

async function execute(id: number, request: AiRequest, controller: AbortController): Promise<void> {
  try {
    const result = await askAi(request, {
      signal: controller.signal,
      onStart: (model) => update(id, { status: 'running', model }),
      onText: (_delta, full) => update(id, { text: full }),
    });
    if (!result) {
      if (current?.id === id) end();
      return;
    }
    update(id, { status: 'done', text: cleanAnswer(result.text), model: result.model, cost: result.cost });
  } catch (err) {
    if (err instanceof AiCancelled) return;
    update(id, { status: 'error', error: err instanceof Error ? err.message : String(err) });
  }
}

export function stopWrite(): void {
  current?.controller.abort();
  const session = useWrite.getState().session;
  if (session && session.status !== 'done') end();
}

export function discardWrite(): void {
  end();
  editorFocus();
}

function editorFocus() {
  const editor = current?.editor;
  if (editor && !editor.isDestroyed) editor.commands.focus();
}

export function retryWrite(): void {
  const session = useWrite.getState().session;
  if (!current || !session) return;
  current.controller.abort();
  const controller = new AbortController();
  current.controller = controller;
  update(session.id, { status: 'preparing', text: '', cost: null, error: null });
  void execute(session.id, current.request, controller);
}

/** Antwort enthält nichts Verwertbares (z. B. keine Aufgaben gefunden). */
export function isEmptyAnswer(text: string): boolean {
  return !text.trim() || text.trim() === 'KEINE';
}

/** Übernimmt das Ergebnis: ersetzt die Auswahl oder fügt es an der passenden Stelle ein. */
export function acceptWrite(placement: 'replace' | 'below' = 'replace'): void {
  const session = useWrite.getState().session;
  if (!current || !session || session.status !== 'done' || isEmptyAnswer(session.text)) return;
  const { editor, from, to } = current;
  if (editor.isDestroyed) return end();
  const content = fromAiMarkdown(session.text);
  const chain = editor.chain().focus();
  if (session.target === 'replace' && placement === 'replace') {
    chain.insertContentAt({ from, to }, asInsertable(content)).run();
  } else if (session.target === 'replace' || session.target === 'cursor') {
    const at = session.target === 'cursor' && placement === 'replace' ? from : afterBlock(editor, to);
    chain.insertContentAt(at, session.target === 'cursor' && placement === 'replace' ? asInsertable(content) : content).run();
  } else if (session.target === 'top') {
    chain.insertContentAt(0, summaryCallout(content)).run();
  } else {
    chain.insertContentAt(editor.state.doc.content.size, [{ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Aufgaben' }] }, ...content]).run();
  }
  end();
}

/** Position direkt hinter dem obersten Block, in dem `pos` liegt. */
function afterBlock(editor: Editor, pos: number): number {
  const $pos = editor.state.doc.resolve(Math.min(pos, editor.state.doc.content.size));
  return $pos.depth >= 1 ? $pos.after(1) : $pos.pos;
}

/** Zusammenfassung als Callout oben auf der Seite (Callouts enthalten nur Absätze). */
function summaryCallout(content: JSONContent[]): JSONContent {
  const paragraphs: JSONContent[] = [{ type: 'paragraph', content: [{ type: 'text', text: 'Zusammenfassung', marks: [{ type: 'bold' }] }] }];
  const walk = (nodes: JSONContent[]) => {
    for (const node of nodes) {
      if (node.type === 'paragraph') paragraphs.push(node);
      else if (node.type === 'heading') paragraphs.push({ type: 'paragraph', content: node.content });
      else if (node.type === 'listItem' || node.type === 'taskItem') {
        const [first, ...rest] = node.content ?? [];
        paragraphs.push({ type: 'paragraph', content: [{ type: 'text', text: '• ' }, ...(first?.content ?? [])] });
        walk(rest);
      } else walk(node.content ?? []);
    }
  };
  walk(content);
  return { type: 'callout', attrs: { icon: '📌' }, content: paragraphs };
}

export const sessionModelName = (session: WriteSession) => (session.model ? modelInfo(session.model).short : '');
