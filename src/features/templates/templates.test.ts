// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { insertBoard, loadBoard, saveBoard } from '../../db/boards';
import { loadDoc, saveContent } from '../../db/content';
import { loadSchema, loadValues } from '../../db/database';
import { commit, flush } from '../../db/saveQueue';
import { useDatabases } from '../../store/databases';
import { usePages } from '../../store/pages';
import { useUI } from '../../store/ui';
import { freshDatabase } from '../../test/setup';
import { duplicatePage } from '../duplicate';
import { specialId } from './special';
import { addToInbox, createFromTemplate, dailyTitle, ensureTemplates, noteDoc, openToday, templateList } from './templates';

const pages = () => usePages.getState().pages;
const childrenOf = (id: string) => usePages.getState().children.get(id) ?? [];

beforeEach(async () => {
  await freshDatabase();
});

describe('Duplizieren', () => {
  it('kopiert Seite, Unterseiten, Datenbank mit Einträgen und Board und biegt Verweise um', async () => {
    const create = usePages.getState().create;
    const root = await create({ title: 'Projekt' });
    const sub = await create({ parentId: root, title: 'Notizen' });
    const db = await useDatabases.getState().createDatabase(root);
    const [status] = useDatabases.getState().data[db].properties;
    const row = await useDatabases.getState().createRow(db, { [status.id]: status.options[1].id });
    const board = await create({ parentId: root, type: 'board', title: 'Skizze', extra: (p) => [insertBoard(p.id, p.createdAt)] });
    await commit(saveBoard(board, { elements: [{ id: 'e1', type: 'rectangle', version: 1, versionNonce: 1 }], files: {} }, '', 1));
    const doc = {
      type: 'doc',
      content: [
        { type: 'pageRef', attrs: { pageId: sub } },
        { type: 'paragraph', content: [{ type: 'pageLink', attrs: { pageId: sub } }] },
        { type: 'databaseBlock', attrs: { databaseId: db } },
        { type: 'boardEmbed', attrs: { pageId: board } },
      ],
    };
    await commit(saveContent(root, doc, '', [sub], 1));
    await flush();

    const copy = await duplicatePage(root);
    await flush();

    expect(pages()[copy].title).toBe('Projekt (Kopie)');
    const kids = childrenOf(copy).map((id) => pages()[id]);
    expect(kids.map((p) => p.title).sort()).toEqual(['', 'Notizen', 'Skizze'].sort());
    const subCopy = kids.find((p) => p.title === 'Notizen')!.id;
    const dbCopy = kids.find((p) => p.type === 'database')!.id;
    const boardCopy = kids.find((p) => p.type === 'board')!.id;

    const json = JSON.stringify(await loadDoc(copy));
    expect(json).toContain(subCopy);
    expect(json).toContain(dbCopy);
    expect(json).toContain(boardCopy);
    expect(json).not.toContain(sub);

    const schema = await loadSchema(dbCopy);
    expect(schema.properties.map((p) => p.name)).toEqual(['Status', 'Tags', 'Datum']);
    expect(schema.properties[0].id).not.toBe(status.id);
    expect(schema.views[1].config.groupBy).toBe(schema.properties[0].id);
    const values = await loadValues(dbCopy);
    const [rowCopy] = Object.keys(values);
    expect(rowCopy).not.toBe(row);
    expect(values[rowCopy][schema.properties[0].id]).toBe(status.options[1].id);

    expect((await loadBoard(boardCopy)).elements).toHaveLength(1);
    // Das Original bleibt unverändert.
    expect(JSON.stringify(await loadDoc(root))).toContain(sub);
  });
});

describe('Vorlagen', () => {
  it('legt beim ersten Mal die mitgelieferten Vorlagen an', async () => {
    await ensureTemplates();
    await ensureTemplates();
    expect(templateList().map((t) => t.title)).toEqual(['Meeting-Notizen', 'Projekt', 'Wochenplan', 'Tagesnotiz', 'Aufgaben', 'Leseliste']);
    expect(childrenOf(specialId('templates')!)).toHaveLength(6);
  });

  it('erstellt eine Datenbank aus einer Vorlage mit Schema und Ansichten', async () => {
    await ensureTemplates();
    const tasks = templateList().find((t) => t.title === 'Aufgaben')!;
    const id = await createFromTemplate(tasks.id, null);
    await flush();
    expect(pages()[id]).toMatchObject({ title: 'Aufgaben', type: 'database', parentId: null });
    const schema = await loadSchema(id);
    expect(schema.properties.map((p) => p.name)).toEqual(['Status', 'Priorität', 'Fällig']);
    expect(schema.views.map((v) => v.type)).toEqual(['board', 'table']);
  });
});

describe('Tagesnotiz und Eingang', () => {
  it('legt die Tagesnotiz einmal an und öffnet danach dieselbe', async () => {
    await openToday();
    const first = useUI.getState().currentId!;
    await openToday();
    expect(useUI.getState().currentId).toBe(first);
    expect(pages()[first].title).toBe(dailyTitle(new Date()));
    expect(pages()[first].parentId).toBe(specialId('daily'));
  });

  it('legt Schnellnotizen als Seite in den Eingang, erste Zeile als Titel', async () => {
    await addToInbox('Milch kaufen\nund Brot\n\nAm Abend');
    await flush();
    const [id] = childrenOf(specialId('inbox')!);
    expect(pages()[id].title).toBe('Milch kaufen');
    expect(await loadDoc(id)).toEqual(noteDoc('und Brot\n\nAm Abend'));
  });

  it('wandelt Zeilen in Absätze und Zeilenumbrüche', () => {
    expect(noteDoc('a\nb\n\nc')).toEqual({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'a' }, { type: 'hardBreak' }, { type: 'text', text: 'b' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'c' }] },
      ],
    });
  });
});
