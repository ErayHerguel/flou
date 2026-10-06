import { beforeEach, describe, expect, it } from 'vitest';
import { usePages } from '../store/pages';
import { freshDatabase } from '../test/setup';
import { saveContent } from './content';
import { flush } from './saveQueue';
import { MARK_END, MARK_START, searchPages, toFtsQuery } from './search';

let driver: Awaited<ReturnType<typeof freshDatabase>>;
beforeEach(async () => {
  driver = await freshDatabase();
});

const write = (id: string, text: string) => driver.tx(saveContent(id, { type: 'doc' }, text, [], Date.now()));

describe('Volltextsuche', () => {
  it('baut sichere Präfix-Abfragen', () => {
    expect(toFtsQuery('Steuer 2026')).toBe('"steuer"* "2026"*');
    expect(toFtsQuery('"); DROP TABLE pages; --')).toBe('"drop"* "table"* "pages"*');
    expect(toFtsQuery('  …  ')).toBeNull();
  });

  it('findet Titel und Inhalt, Titel zuerst, ohne Umlaut-Probleme', async () => {
    const a = await usePages.getState().create({ title: 'Einkaufsliste' });
    const b = await usePages.getState().create({ title: 'Notizen' });
    await write(b, 'Morgen Äpfel und Brot für die Einkäufe besorgen.');
    expect((await searchPages('einkauf')).map((h) => h.id)).toEqual([a, b]);
    expect((await searchPages('apfel')).map((h) => h.id)).toEqual([b]);
    const [hit] = await searchPages('brot');
    expect(hit.snippet).toContain(`${MARK_START}Brot${MARK_END}`);
  });

  it('folgt Umbenennen, Papierkorb und endgültigem Löschen', async () => {
    const parent = await usePages.getState().create({ title: 'Projekt Alpha' });
    const child = await usePages.getState().create({ title: 'Unterseite', parentId: parent });
    await write(child, 'Geheimes Stichwort Zebra');
    usePages.getState().update(parent, { title: 'Projekt Beta' });
    await flush();
    expect(await searchPages('alpha')).toEqual([]);
    expect((await searchPages('beta')).map((h) => h.id)).toEqual([parent]);
    await usePages.getState().trash(parent);
    expect(await searchPages('zebra')).toEqual([]);
    await usePages.getState().deleteForever(parent);
    expect(await driver.select('SELECT rowid FROM pages_fts')).toEqual([]);
  });

  it('antwortet bei 5.000 Seiten in unter 50 ms', async () => {
    const words = ['Planung', 'Budget', 'Meeting', 'Rezept', 'Reise', 'Code', 'Garten', 'Buch', 'Idee', 'Sport'];
    driver.raw.exec('BEGIN');
    const insertPage = driver.raw.prepare(
      `INSERT INTO pages (id, workspace_id, title, created_at, updated_at) VALUES (?, 'default', ?, 0, 0)`,
    );
    const insertContent = driver.raw.prepare('INSERT INTO page_content (page_id, doc, text, updated_at) VALUES (?, ?, ?, 0)');
    for (let i = 0; i < 5000; i++) {
      const body = Array.from({ length: 300 }, (_, j) => words[(i * 7 + j * 3) % words.length] + (j % 50)).join(' ');
      insertPage.run(`p${i}`, `${words[i % words.length]} ${i}`);
      insertContent.run(`p${i}`, '{}', i === 4321 ? `${body} Nadelimheuhaufen` : body);
    }
    driver.raw.exec('COMMIT');

    await searchPages('budget');
    const start = performance.now();
    const rare = await searchPages('nadelimheu');
    const common = await searchPages('rezept garten');
    const elapsed = (performance.now() - start) / 2;
    expect(rare.map((h) => h.id)).toEqual(['p4321']);
    expect(common.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(50);
  });
});
