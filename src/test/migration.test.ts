import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const dir = join(__dirname, '../../src-tauri/migrations');
const run = (db: DatabaseSync, file: string) => db.exec(readFileSync(join(dir, file), 'utf8'));

describe('Migration 004', () => {
  it('übernimmt Properties, Werte und Ansichten verlustfrei', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    for (const f of ['001_init.sql', '002_databases.sql', '003_search.sql']) run(db, f);
    db.exec(`INSERT INTO pages (id, workspace_id, type, title, created_at, updated_at) VALUES ('db', 'default', 'database', 'DB', 0, 0), ('r', 'default', 'page', 'Zeile', 0, 0);
      UPDATE pages SET parent_id = 'db' WHERE id = 'r';
      INSERT INTO db_properties (id, database_id, name, type) VALUES ('p', 'db', 'Notiz', 'text');
      INSERT INTO db_values VALUES ('r', 'p', '"hallo"');
      INSERT INTO db_views (id, database_id, name, type) VALUES ('v', 'db', 'Tabelle', 'table');`);
    db.exec('BEGIN');
    run(db, '004_extras.sql');
    db.exec('COMMIT');
    expect(db.prepare('SELECT value FROM db_values').all()).toEqual([{ value: '"hallo"' }]);
    expect(db.prepare('SELECT config FROM db_properties').all()).toEqual([{ config: '{}' }]);
    expect(db.prepare("SELECT count(*) AS n FROM pages_fts WHERE pages_fts MATCH 'zeile'").get()).toEqual({ n: 1 });
    db.exec("INSERT INTO db_properties (id, database_id, name, type) VALUES ('f', 'db', 'Formel', 'formula')");
    db.exec("DELETE FROM db_properties WHERE id = 'p'");
    expect(db.prepare('SELECT count(*) AS n FROM db_values').get()).toEqual({ n: 0 });
    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  });
});
