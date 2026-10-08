import { beforeEach, describe, expect, it } from 'vitest';
import { flush } from '../db/saveQueue';
import { useDatabases } from '../store/databases';
import { freshDatabase } from '../test/setup';
import { dueToday, ymd } from './reminders';

beforeEach(async () => {
  await freshDatabase();
});

describe('Erinnerungen', () => {
  it('findet heute fällige Einträge nur bei Datums-Properties mit Erinnerung', async () => {
    const store = useDatabases.getState();
    const db = await store.createDatabase(null);
    const date = useDatabases.getState().data[db].properties.find((p) => p.type === 'date')!;
    const today = ymd(new Date(2026, 9, 8));
    const due = await store.createRow(db, { [date.id]: today });
    await store.createRow(db, { [date.id]: '2026-10-09' });
    await flush();
    expect(await dueToday(today)).toEqual([]);

    store.updateProperty({ ...date, config: { ...date.config, remind: true } });
    await flush();
    expect((await dueToday(today)).map((d) => d.pageId)).toEqual([due]);
    expect(today).toBe('2026-10-08');
  });
});
