import { describe, expect, it } from 'vitest';
import type { Property, SelectOption } from '../../../db/database';
import { describeDatabase, planDatabase, toCellValue, type DbSnapshot } from './dbModel';

const prop = (id: string, name: string, type: Property['type'], options: SelectOption[] = []): Property => ({
  id,
  databaseId: 'db',
  name,
  type,
  options,
  config: {},
  sortOrder: 0,
});

const status = prop('p1', 'Status', 'select', [{ id: 'o1', name: 'Offen', color: 'gray' }]);
const db: DbSnapshot = {
  properties: [status, prop('p2', 'Preis', 'number'), prop('p3', 'Fällig', 'date'), prop('p4', 'Fertig', 'checkbox'), prop('p5', 'Summe', 'formula')],
  rows: [
    { id: 'row-a', title: 'Brief 1', values: { p1: 'o1', p2: 8.5 } },
    { id: 'row-b', title: 'Brief 2', values: {} },
  ],
};

describe('Datenbank für die KI', () => {
  it('zeigt Spalten mit Typ und Einträge mit Kurz-ID', () => {
    const text = describeDatabase(db, () => '');
    expect(text).toContain('- Status (Auswahl; Optionen: Offen)');
    expect(text).toContain('| r1 | Brief 1 | Offen | 8.5 |');
    expect(text).not.toContain('Summe');
  });

  it('wandelt Texte passend zum Typ um', () => {
    const fresh: SelectOption[] = [];
    expect(toCellValue(prop('n', 'n', 'number'), '1.234,5', fresh)).toBe(1234.5);
    expect(toCellValue(prop('d', 'd', 'date'), '9.10.2026', fresh)).toBe('2026-10-09');
    expect(toCellValue(prop('c', 'c', 'checkbox'), 'ja', fresh)).toBe(true);
    expect(toCellValue(status, 'offen', fresh)).toBe('o1');
    expect(toCellValue(status, 'Erledigt', fresh)).toBe(fresh[0].id);
    expect(toCellValue(prop('n', 'n', 'number'), 'viel', fresh)).toBeUndefined();
  });

  it('plant neue Einträge und Änderungen, legt fehlende Optionen an', () => {
    const plan = planDatabase(
      {
        summary: '',
        add: [{ title: 'Brief 3', values: [{ column: 'Status', value: 'In Arbeit' }, { column: 'Gibt es nicht', value: 'x' }] }],
        update: [
          { row: 'r2', title: '', values: [{ column: 'preis', value: '7' }] },
          { row: 'r9', title: 'weg', values: [] },
        ],
      },
      db,
      () => '',
    );
    expect(plan.add).toHaveLength(1);
    expect(plan.options.get('p1')?.map((o) => o.name)).toEqual(['In Arbeit']);
    expect(plan.add[0].values.p1).toBe(plan.options.get('p1')![0].id);
    expect(plan.update).toEqual([{ rowId: 'row-b', title: null, values: { p2: 7 } }]);
    expect(plan.changes.map((c) => c.kind)).toEqual(['added', 'changed']);
  });
});
