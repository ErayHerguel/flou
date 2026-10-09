import { loadDoc } from '../../db/content';
import { getActiveEditor } from '../../editor/active';
import { usePages } from '../../store/pages';
import { reportError, toast } from '../../store/toast';
import { useUI } from '../../store/ui';
import { useActiveBoard } from '../board/active';
import { AiCancelled, askAi, costNote } from './client';
import { buildModel, describeBoard } from './edit/boardModel';
import { toAiMarkdown } from './markdown';

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'icon'],
  properties: { title: { type: 'string' }, icon: { type: 'string' } },
};

/** Inhalt der Seite als Text, egal ob Notiz, Board oder Datenbank */
async function contentOf(pageId: string): Promise<string> {
  const pages = usePages.getState();
  const page = pages.pages[pageId];
  if (page?.type === 'board') {
    const bridge = useActiveBoard.getState().bridge;
    return bridge?.pageId === pageId ? describeBoard(buildModel(bridge.snapshot().elements), null) : '';
  }
  if (page?.type === 'database') {
    return (pages.children.get(pageId) ?? []).map((id) => `- ${pages.pages[id]?.title ?? ''}`).join('\n');
  }
  const editor = useUI.getState().currentId === pageId ? getActiveEditor() : null;
  const doc = editor ? editor.getJSON() : await loadDoc(pageId);
  return doc ? toAiMarkdown(doc) : '';
}

/** Schlägt einen kurzen Titel und ein passendes Emoji vor und setzt beides (mit Hinweis auf den alten Titel). */
export async function suggestTitle(pageId: string): Promise<void> {
  try {
    const text = (await contentOf(pageId)).slice(0, 20_000);
    if (!text.trim()) return toast('Die Seite ist noch leer');
    const result = await askAi({
      feature: 'rewrite',
      title: 'Titel und Icon vorschlagen',
      system:
        'Du gibst Notizseiten einen kurzen, treffenden Titel (höchstens 6 Wörter, ohne Anführungszeichen, ohne Punkt am Ende) und genau ein passendes Emoji als Icon. Sprache wie der Inhalt.',
      messages: [{ role: 'user', content: `<inhalt>\n${text}\n</inhalt>` }],
      maxTokens: 2_000,
      effort: 'low',
      output: [60, 400],
      schema: SCHEMA,
      mock: () => JSON.stringify({ title: 'Simulierter Titel', icon: '✨' }),
    });
    if (!result) return;
    const { title, icon } = JSON.parse(result.text) as { title: string; icon: string };
    const before = usePages.getState().pages[pageId]?.title;
    usePages.getState().update(pageId, { title: title.trim(), icon: icon.trim() && icon.trim().length <= 8 ? icon.trim() : null });
    toast(`Titel: „${title.trim()}“${before ? ` (vorher „${before}“)` : ''} · ${costNote(result)}`);
  } catch (err) {
    if (!(err instanceof AiCancelled)) reportError('Titel vorschlagen', err);
  }
}
