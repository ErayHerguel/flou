import type { JSONContent } from '@tiptap/core';
import { saveContent } from '../../db/content';
import type { PageMeta } from '../../db/pages';
import { jsonText } from '../../lib/doc';
import { buildChildIndex, type PageMap } from '../../lib/tree';
import { usePages } from '../../store/pages';
import { reportError, toast } from '../../store/toast';
import { useUI } from '../../store/ui';
import { duplicatePage } from '../duplicate';
import { ensureSpecial, specialId } from './special';
import { DAILY_DOC, starterTemplates } from './starters';

/** Vorlagen sind die Unterseiten der Seite „Vorlagen“. Beim ersten Mal kommen mitgelieferte dazu. */
export async function ensureTemplates(): Promise<string> {
  let added: PageMeta[] = [];
  const id = await ensureSpecial('templates', (root) => {
    const starters = starterTemplates(root.id, Date.now());
    added = starters.pages;
    return starters.statements;
  });
  if (added.length) {
    const pages: PageMap = { ...usePages.getState().pages };
    for (const page of added) pages[page.id] = page;
    usePages.setState({ pages, children: buildChildIndex(pages) });
  }
  return id;
}

export function templateList(): PageMeta[] {
  const root = specialId('templates');
  if (!root) return [];
  const { pages, children } = usePages.getState();
  return (children.get(root) ?? []).map((id) => pages[id]).filter((p) => p && p.deletedAt === null);
}

/** Neue Seite (bzw. Datenbank oder Board) als Kopie einer Vorlage. */
export function createFromTemplate(templateId: string, parentId: string | null, index?: number): Promise<string> {
  const template = usePages.getState().pages[templateId];
  return duplicatePage(templateId, { parentId, index, title: template?.title ?? '' });
}

export async function saveAsTemplate(pageId: string): Promise<void> {
  try {
    const root = await ensureTemplates();
    const page = usePages.getState().pages[pageId];
    await duplicatePage(pageId, { parentId: root, title: page?.title ?? '' });
    useUI.getState().setExpanded(root, true);
    toast(`„${page?.title || 'Ohne Titel'}“ ist jetzt eine Vorlage`);
  } catch (err) {
    reportError('Vorlage konnte nicht gespeichert werden', err);
  }
}

const DAY = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** Titel der Tagesnotiz, z. B. „Mittwoch, 8. Oktober 2026“. */
export const dailyTitle = (date: Date) => DAY.format(date);

/** Öffnet die Tagesnotiz von heute und legt sie bei Bedarf an (aus der Vorlage „Tagesnotiz“, falls vorhanden). */
export async function openToday(): Promise<void> {
  try {
    const root = await ensureSpecial('daily');
    const title = dailyTitle(new Date());
    const { pages, children } = usePages.getState();
    let id = (children.get(root) ?? []).find((child) => pages[child]?.title === title && pages[child].deletedAt === null);
    let fresh = false;
    if (!id) {
      const template = templateList().find((t) => t.title === 'Tagesnotiz' && t.type === 'page');
      id = template
        ? await duplicatePage(template.id, { parentId: root, index: 0, title })
        : await usePages.getState().create({
            parentId: root,
            index: 0,
            title,
            extra: (page) => saveContent(page.id, DAILY_DOC, jsonText(DAILY_DOC), [], Date.now()),
          });
      fresh = true;
    }
    useUI.getState().setExpanded(root, true);
    useUI.getState().open(id);
    if (fresh) useUI.getState().requestFocus('editor');
  } catch (err) {
    reportError('Tagesnotiz konnte nicht geöffnet werden', err);
  }
}

/** Text einer Schnellnotiz als Seiteninhalt: Absätze, einfache Zeilenumbrüche bleiben erhalten. */
export function noteDoc(body: string): JSONContent {
  return {
    type: 'doc',
    content: body.split(/\n{2,}/).map((paragraph) => ({
      type: 'paragraph',
      content: paragraph
        .split('\n')
        .flatMap((line, i): JSONContent[] => [...(i > 0 ? [{ type: 'hardBreak' }] : []), ...(line ? [{ type: 'text', text: line }] : [])]),
    })),
  };
}

/** Schnellnotiz in den Eingang legen: erste Zeile wird zum Titel, der Rest zum Inhalt. */
export async function addToInbox(text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  const [first, ...rest] = trimmed.split('\n');
  const title = first.trim().slice(0, 200);
  const body = rest.join('\n').trim();
  try {
    const root = await ensureSpecial('inbox');
    await usePages.getState().create({
      parentId: root,
      index: 0,
      title,
      extra: (page) => (body ? saveContent(page.id, noteDoc(body), body, [], Date.now()) : []),
    });
    toast(`„${title}“ liegt im Eingang`);
  } catch (err) {
    reportError('Schnellnotiz konnte nicht gespeichert werden', err);
  }
}
