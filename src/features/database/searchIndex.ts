import { loadSchema, loadValues, setSearchProps } from '../../db/database';
import type { Statement } from '../../db/driver';
import { commit } from '../../db/saveQueue';
import { setSetting } from '../../db/settings';
import { rowSearchText } from '../../store/databases';
import { usePages } from '../../store/pages';

const KEY = 'search.props';

/** Einmalig: Werte aller Datenbank-Einträge in die Volltextsuche übernehmen (danach pflegt der Store sie). */
export async function indexDatabaseValues(settings: Record<string, string>): Promise<void> {
  if (settings[KEY] === '1') return;
  const statements: Statement[] = [];
  const databases = Object.values(usePages.getState().pages).filter((p) => p.type === 'database');
  for (const database of databases) {
    const [schema, values] = await Promise.all([loadSchema(database.id), loadValues(database.id)]);
    for (const rowId of Object.keys(values)) {
      statements.push(setSearchProps(rowId, rowSearchText({ properties: schema.properties, values }, rowId)));
    }
  }
  await commit([...statements, setSetting(KEY, '1')]);
}
