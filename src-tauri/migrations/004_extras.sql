-- Versionsverlauf von Seiten
CREATE TABLE page_versions (
  id INTEGER PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  doc TEXT NOT NULL,
  text TEXT NOT NULL DEFAULT ''
);
CREATE INDEX page_versions_page ON page_versions(page_id, created_at);

-- Neue Property-Typen (Relation, Rollup, Formel) und Konfiguration.
-- SQLite kann CHECK nicht ändern: Tabellen neu anlegen. Werte zuerst umziehen,
-- damit das Löschen der alten Properties nichts kaskadierend mitlöscht.
CREATE TABLE db_properties_new (
  id TEXT PRIMARY KEY,
  database_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text', 'number', 'select', 'multi_select', 'date', 'checkbox', 'url', 'relation', 'rollup', 'formula')),
  options TEXT NOT NULL DEFAULT '[]',
  config TEXT NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0
);
INSERT INTO db_properties_new (id, database_id, name, type, options, sort_order)
SELECT id, database_id, name, type, options, sort_order FROM db_properties;

CREATE TABLE db_values_new (
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  property_id TEXT NOT NULL REFERENCES db_properties_new(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  PRIMARY KEY (page_id, property_id)
) WITHOUT ROWID;
INSERT INTO db_values_new (page_id, property_id, value) SELECT page_id, property_id, value FROM db_values;

DROP TABLE db_values;
DROP TABLE db_properties;
ALTER TABLE db_properties_new RENAME TO db_properties;
ALTER TABLE db_values_new RENAME TO db_values;
CREATE INDEX db_properties_database ON db_properties(database_id, sort_order);
CREATE INDEX db_values_property ON db_values(property_id);

-- Neue Ansichtstypen
CREATE TABLE db_views_new (
  id TEXT PRIMARY KEY,
  database_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('table', 'board', 'calendar', 'gallery', 'list')),
  config TEXT NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0
);
INSERT INTO db_views_new SELECT id, database_id, name, type, config, sort_order FROM db_views;
DROP TABLE db_views;
ALTER TABLE db_views_new RENAME TO db_views;
CREATE INDEX db_views_database ON db_views(database_id, sort_order);

-- Volltextsuche zusätzlich über Datenbank-Werte (Spalte props, von der App gepflegt)
DROP TRIGGER pages_fts_insert;
DROP TRIGGER pages_fts_title;
DROP TRIGGER pages_fts_delete;
DROP TRIGGER content_fts_insert;
DROP TRIGGER content_fts_update;
DROP TABLE pages_fts;

CREATE VIRTUAL TABLE pages_fts USING fts5(
  title,
  body,
  props,
  tokenize = 'unicode61 remove_diacritics 2',
  prefix = '2 3'
);
INSERT INTO pages_fts (rowid, title, body, props)
SELECT p.rid, p.title, COALESCE(c.text, ''), '' FROM pages p LEFT JOIN page_content c ON c.page_id = p.id;

CREATE TRIGGER pages_fts_insert AFTER INSERT ON pages BEGIN
  INSERT INTO pages_fts (rowid, title, body, props) VALUES (new.rid, new.title, '', '');
END;
CREATE TRIGGER pages_fts_title AFTER UPDATE OF title ON pages BEGIN
  UPDATE pages_fts SET title = new.title WHERE rowid = new.rid;
END;
CREATE TRIGGER pages_fts_delete AFTER DELETE ON pages BEGIN
  DELETE FROM pages_fts WHERE rowid = old.rid;
END;
CREATE TRIGGER content_fts_insert AFTER INSERT ON page_content BEGIN
  UPDATE pages_fts SET body = new.text WHERE rowid = (SELECT rid FROM pages WHERE id = new.page_id);
END;
CREATE TRIGGER content_fts_update AFTER UPDATE OF text ON page_content BEGIN
  UPDATE pages_fts SET body = new.text WHERE rowid = (SELECT rid FROM pages WHERE id = new.page_id);
END;
