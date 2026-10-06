import { describe, expect, it } from 'vitest';
import { TITLE_PROPERTY, type Property } from '../../db/database';
import { applyView, convertProperty, groupRows, matchesFilter, type Row } from './query';

const status: Property = {
  id: 'status',
  databaseId: 'db',
  name: 'Status',
  type: 'select',
  sortOrder: 0,
  options: [
    { id: 'todo', name: 'Offen', color: 'gray' },
    { id: 'doing', name: 'In Arbeit', color: 'blue' },
    { id: 'done', name: 'Erledigt', color: 'green' },
  ],
};
const prio: Property = { id: 'prio', databaseId: 'db', name: 'Priorität', type: 'number', options: [], sortOrder: 1 };
const due: Property = { id: 'due', databaseId: 'db', name: 'Fällig', type: 'date', options: [], sortOrder: 2 };
const tags: Property = {
  id: 'tags',
  databaseId: 'db',
  name: 'Tags',
  type: 'multi_select',
  sortOrder: 3,
  options: [
    { id: 'a', name: 'Arbeit', color: 'red' },
    { id: 'p', name: 'Privat', color: 'blue' },
  ],
};
const done: Property = { id: 'ok', databaseId: 'db', name: 'Fertig', type: 'checkbox', options: [], sortOrder: 4 };
const props = [status, prio, due, tags, done];

const row = (id: string, title: string, values: Row['values'], sortOrder = 0): Row => ({ id, title, values, sortOrder, createdAt: 0 });

const rows: Row[] = [
  row('1', 'Steuererklärung', { status: 'doing', prio: 3, due: '2026-03-01', tags: ['a'] }, 0),
  row('2', 'Urlaub planen', { status: 'todo', prio: 1, tags: ['p'] }, 1),
  row('3', 'Bericht 10', { status: 'done', prio: 2, due: '2026-01-15', ok: true }, 2),
  row('4', 'Bericht 9', {}, 3),
];

const ids = (list: Row[]) => list.map((r) => r.id);

describe('Datenbank-Ansichten', () => {
  it('filtert nach Text, Zahl, Auswahl, Mehrfachauswahl, Datum und Checkbox', () => {
    const f = (propertyId: string, operator: Parameters<typeof matchesFilter>[1]['operator'], value: Row['values'][string] = null) =>
      ids(applyView(rows, props, { filters: [{ id: 'f', propertyId, operator, value }], sorts: [] }));
    expect(f(TITLE_PROPERTY, 'contains', 'bericht')).toEqual(['3', '4']);
    expect(f('prio', 'gte', 2)).toEqual(['1', '3']);
    expect(f('prio', 'is_empty')).toEqual(['4']);
    expect(f('status', 'is', 'todo')).toEqual(['2']);
    expect(f('status', 'is_not', 'todo')).toEqual(['1', '3', '4']);
    expect(f('tags', 'contains', 'a')).toEqual(['1']);
    expect(f('due', 'before', '2026-02-01')).toEqual(['3']);
    expect(f('ok', 'is_checked')).toEqual(['3']);
    expect(f('ok', 'is_unchecked')).toEqual(['1', '2', '4']);
  });

  it('ignoriert unvollständige Filter und Filter auf gelöschte Properties', () => {
    const result = applyView(rows, props, {
      filters: [
        { id: 'a', propertyId: 'status', operator: 'is', value: null },
        { id: 'b', propertyId: 'weg', operator: 'is_empty', value: null },
      ],
      sorts: [],
    });
    expect(result).toHaveLength(4);
  });

  it('sortiert natürlich, mit leeren Werten am Ende, und mehrstufig', () => {
    expect(ids(applyView(rows, props, { filters: [], sorts: [{ propertyId: TITLE_PROPERTY, direction: 'asc' }] }))).toEqual(['4', '3', '1', '2']);
    expect(ids(applyView(rows, props, { filters: [], sorts: [{ propertyId: 'prio', direction: 'desc' }] }))).toEqual(['1', '3', '2', '4']);
    expect(ids(applyView(rows, props, { filters: [], sorts: [{ propertyId: 'status', direction: 'asc' }] }))).toEqual(['2', '1', '3', '4']);
    expect(ids(applyView(rows, props, { filters: [], sorts: [{ propertyId: 'due', direction: 'asc' }] }))).toEqual(['3', '1', '2', '4']);
  });

  it('gruppiert für das Board nach Auswahl, unbekannte Werte landen ohne Wert', () => {
    const extra = [...rows, row('5', 'Alt', { status: 'gelöschte-option' })];
    const groups = groupRows(extra, status);
    expect(groups.map((g) => g.option?.name ?? null)).toEqual([null, 'Offen', 'In Arbeit', 'Erledigt']);
    expect(groups.map((g) => ids(g.rows))).toEqual([['4', '5'], ['2'], ['1'], ['3']]);
  });
});

describe('Typumwandlung', () => {
  it('macht aus Text Auswahloptionen und übernimmt die Werte', () => {
    const text: Property = { ...prio, id: 't', type: 'text' };
    const { property, values } = convertProperty(text, 'select', { r1: 'Hoch', r2: 'niedrig', r3: 'hoch', r4: '' });
    expect(property.options.map((o) => o.name)).toEqual(['Hoch', 'niedrig']);
    expect(values.r1).toBe(values.r3);
    expect(values.r4).toBeUndefined();
  });

  it('wandelt zwischen Auswahl und Mehrfachauswahl ohne Verlust', () => {
    const multi = convertProperty(status, 'multi_select', { r1: 'doing' });
    expect(multi.values).toEqual({ r1: ['doing'] });
    expect(multi.property.options).toEqual(status.options);
    expect(convertProperty(tags, 'select', { r1: ['p', 'a'] }).values).toEqual({ r1: 'p' });
  });

  it('wandelt in Text, Zahl, Checkbox und Datum', () => {
    expect(convertProperty(tags, 'text', { r1: ['a', 'p'] }).values).toEqual({ r1: 'Arbeit, Privat' });
    const text: Property = { ...prio, id: 't', type: 'text' };
    expect(convertProperty(text, 'number', { a: '3,5', b: 'abc' }).values).toEqual({ a: 3.5 });
    expect(convertProperty(text, 'checkbox', { a: 'ja', b: 'nein' }).values).toEqual({ a: true });
    expect(convertProperty(text, 'date', { a: '2026-05-01', b: 'morgen' }).values).toEqual({ a: '2026-05-01' });
    expect(convertProperty(prio, 'text', { a: 2 }).values).toEqual({ a: '2' });
  });
});
