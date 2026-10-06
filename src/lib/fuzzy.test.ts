import { describe, expect, it } from 'vitest';
import { fuzzyFilter, fuzzyScore } from './fuzzy';

describe('Fuzzy-Suche', () => {
  it('findet Teilfolgen und lehnt Nicht-Treffer ab', () => {
    expect(fuzzyScore('ue1', 'Überschrift 1')).not.toBeNull();
    expect(fuzzyScore('xyz', 'Überschrift')).toBeNull();
  });

  it('bevorzugt direkte Treffer am Wortanfang', () => {
    const items = ['Codeblock', 'Zitat', 'To-do-Liste', 'Callout'];
    expect(fuzzyFilter(items, 'co', (s) => [s])[0]).toBe('Codeblock');
    expect(fuzzyFilter(items, 'todo', (s) => [s])[0]).toBe('To-do-Liste');
  });

  it('ignoriert Akzente und ß', () => {
    expect(fuzzyScore('strasse', 'Straße')).not.toBeNull();
    expect(fuzzyScore('uber', 'Über')).not.toBeNull();
  });

  it('durchsucht auch Schlüsselwörter', () => {
    const items = [{ title: 'Trenner', keys: ['divider', 'hr', 'linie'] }, { title: 'Text', keys: [] }];
    expect(fuzzyFilter(items, 'divider', (i) => [i.title, ...i.keys]).map((i) => i.title)).toEqual(['Trenner']);
  });

  it('gibt bei leerer Anfrage alles in Originalreihenfolge zurück', () => {
    expect(fuzzyFilter([3, 1, 2], '  ', (n) => [String(n)])).toEqual([3, 1, 2]);
  });
});
