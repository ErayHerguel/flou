import { beforeEach, describe, expect, it } from 'vitest';
import { loadBacklinks } from '../../db/links';
import { searchPages } from '../../db/search';
import { usePages } from '../../store/pages';
import { freshDatabase } from '../../test/setup';
import { importEntries } from './transfer';

beforeEach(async () => {
  await freshDatabase();
});

describe('Markdown-Import', () => {
  it('legt Seitenbaum, Inhalte und Links in einer Transaktion an', async () => {
    await importEntries(
      [
        { rel: 'Rezepte.md', abs: '/i/Rezepte.md', content: '# Rezepte\n\nLieblingsgericht: [Lasagne](Rezepte/Lasagne.md)' },
        { rel: 'Rezepte/Lasagne.md', abs: '/i/Rezepte/Lasagne.md', content: '- [ ] Béchamel kochen\n- [x] Nudeln kaufen' },
        { rel: 'Rezepte/Pizza.md', abs: '/i/Rezepte/Pizza.md', content: 'Teig über Nacht gehen lassen.' },
      ],
      'Import',
    );
    const { pages, children } = usePages.getState();
    const byTitle = Object.fromEntries(Object.values(pages).map((p) => [p.title, p]));
    expect(children.get(null)).toEqual([byTitle['Import'].id]);
    expect(children.get(byTitle['Import'].id)).toEqual([byTitle['Rezepte'].id]);
    expect(children.get(byTitle['Rezepte'].id)).toEqual([byTitle['Lasagne'].id, byTitle['Pizza'].id]);
    expect((await searchPages('bechamel')).map((h) => h.id)).toEqual([byTitle['Lasagne'].id]);
    expect(await loadBacklinks(byTitle['Lasagne'].id)).toEqual([byTitle['Rezepte'].id]);
  });
});
