import { beforeEach, describe, expect, it } from 'vitest';
import { flush } from '../db/saveQueue';
import { searchPages } from '../db/search';
import { freshDatabase } from '../test/setup';
import { useDatabases } from './databases';
import { usePages } from './pages';

const db = () => useDatabases.getState();
let driver: Awaited<ReturnType<typeof freshDatabase>>;

beforeEach(async () => {
  driver = await freshDatabase();
});

async function reload(databaseId: string) {
  await flush();
  useDatabases.setState({ data: {} });
  await usePages.getState().load();
  await db().load(databaseId);
  return db().data[databaseId];
}

describe('Datenbank-Store', () => {
  it('legt eine Datenbank mit Standard-Schema an', async () => {
    const id = await db().createDatabase(null);
    const data = await reload(id);
    expect(usePages.getState().pages[id].type).toBe('database');
    expect(data.properties.map((p) => [p.name, p.type])).toEqual([
      ['Status', 'select'],
      ['Tags', 'multi_select'],
      ['Datum', 'date'],
    ]);
    expect(data.views.map((v) => v.type)).toEqual(['table', 'board']);
    expect(data.views[1].config.groupBy).toBe(data.properties[0].id);
  });

  it('speichert Einträge als Seiten mit Werten', async () => {
    const id = await db().createDatabase(null);
    const [status, , date] = db().data[id].properties;
    const row = await db().createRow(id, { [status.id]: status.options[1].id });
    db().setValue(id, row, date.id, '2026-10-06');
    usePages.getState().update(row, { title: 'Erster Eintrag' });
    const data = await reload(id);
    expect(usePages.getState().pages[row]).toMatchObject({ parentId: id, title: 'Erster Eintrag', type: 'page' });
    expect(data.values[row]).toEqual({ [status.id]: status.options[1].id, [date.id]: '2026-10-06' });
  });

  it('löscht leere Werte statt sie zu speichern', async () => {
    const id = await db().createDatabase(null);
    const tags = db().data[id].properties[1];
    const row = await db().createRow(id);
    db().setValue(id, row, tags.id, ['x']);
    await flush();
    db().setValue(id, row, tags.id, []);
    await flush();
    expect(await driver.select('SELECT * FROM db_values')).toEqual([]);
  });

  it('wandelt den Typ einer Property samt Werten um', async () => {
    const id = await db().createDatabase(null);
    const textId = await db().addProperty(id, 'text');
    const a = await db().createRow(id, { [textId]: 'Hoch' });
    const b = await db().createRow(id, { [textId]: 'Niedrig' });
    const text = db().data[id].properties.find((p) => p.id === textId)!;
    await db().changePropertyType(text, 'select');
    const data = await reload(id);
    const converted = data.properties.find((p) => p.id === textId)!;
    expect(converted.type).toBe('select');
    expect(converted.options.map((o) => o.name)).toEqual(['Hoch', 'Niedrig']);
    expect(converted.options.find((o) => o.id === data.values[a][textId])?.name).toBe('Hoch');
    expect(converted.options.find((o) => o.id === data.values[b][textId])?.name).toBe('Niedrig');
  });

  it('entfernt gelöschte Optionen auch aus den Werten', async () => {
    const id = await db().createDatabase(null);
    const status = db().data[id].properties[0];
    const row = await db().createRow(id, { [status.id]: status.options[0].id });
    await db().deleteOption(status, status.options[0].id);
    const data = await reload(id);
    expect(data.properties[0].options).toHaveLength(2);
    expect(data.values[row]).toBeUndefined();
  });

  it('löscht Properties mit ihren Werten und bereinigt Ansichten', async () => {
    const id = await db().createDatabase(null);
    const status = db().data[id].properties[0];
    await db().createRow(id, { [status.id]: status.options[0].id });
    await db().deleteProperty(status);
    const data = await reload(id);
    expect(data.properties.map((p) => p.name)).toEqual(['Tags', 'Datum']);
    expect(data.views[1].config.groupBy).toBeNull();
    expect(await driver.select('SELECT * FROM db_values')).toEqual([]);
  });

  it('legt mit der Datenbank auch ihre Einträge in den Papierkorb', async () => {
    const id = await db().createDatabase(null);
    const row = await db().createRow(id);
    await usePages.getState().trash(id);
    expect(usePages.getState().pages[row].deletedAt).not.toBeNull();
    await usePages.getState().restore(id);
    expect(usePages.getState().pages[row].deletedAt).toBeNull();
  });

  it('findet Einträge über ihre Werte in der Volltextsuche', async () => {
    const id = await db().createDatabase(null);
    const [status] = db().data[id].properties;
    const row = await db().createRow(id, { [status.id]: status.options[2].id });
    await flush();
    expect((await searchPages('erledigt')).map((h) => h.id)).toEqual([row]);
  });

  it('speichert Relationen und Konfiguration berechneter Properties', async () => {
    const a = await db().createDatabase(null);
    const b = await db().createDatabase(null);
    const relId = await db().addProperty(a, 'relation');
    const rel = db().data[a].properties.find((p) => p.id === relId)!;
    db().updateProperty({ ...rel, config: { targetDatabaseId: b } });
    const target = await db().createRow(b);
    const row = await db().createRow(a);
    db().setValue(a, row, relId, [target]);
    const formulaId = await db().addProperty(a, 'formula');
    const formula = db().data[a].properties.find((p) => p.id === formulaId)!;
    db().updateProperty({ ...formula, config: { expression: '1 + 1' } });
    const data = await reload(a);
    expect(data.properties.find((p) => p.id === relId)!.config.targetDatabaseId).toBe(b);
    expect(data.properties.find((p) => p.id === formulaId)!.config.expression).toBe('1 + 1');
    expect(data.values[row][relId]).toEqual([target]);
  });

  it('speichert Ansichts-Konfiguration', async () => {
    const id = await db().createDatabase(null);
    const view = db().data[id].views[0];
    db().updateView({ ...view, config: { ...view.config, widths: { __title: 320 }, sorts: [{ propertyId: '__title', direction: 'desc' }] } });
    const data = await reload(id);
    expect(data.views[0].config.widths).toEqual({ __title: 320 });
    expect(data.views[0].config.sorts).toEqual([{ propertyId: '__title', direction: 'desc' }]);
  });
});
