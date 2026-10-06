-- Datenbanken: Eine Seite vom Typ 'database' besitzt Properties und Ansichten.
-- Ihre Einträge sind normale Seiten mit parent_id = Datenbank; die Werte liegen in db_values.

CREATE TABLE db_properties (
  id TEXT PRIMARY KEY,
  database_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text', 'number', 'select', 'multi_select', 'date', 'checkbox', 'url')),
  -- Auswahloptionen als JSON: [{"id": "...", "name": "...", "color": "blue"}]
  options TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX db_properties_database ON db_properties(database_id, sort_order);

-- Wert als JSON: Text/URL/Datum als String, Zahl, Wahrheitswert, Options-ID oder Liste von Options-IDs.
CREATE TABLE db_values (
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  property_id TEXT NOT NULL REFERENCES db_properties(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  PRIMARY KEY (page_id, property_id)
) WITHOUT ROWID;

CREATE INDEX db_values_property ON db_values(property_id);

CREATE TABLE db_views (
  id TEXT PRIMARY KEY,
  database_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('table', 'board')),
  -- Filter, Sortierung, Spaltenbreiten, ausgeblendete Properties, Gruppierung
  config TEXT NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX db_views_database ON db_views(database_id, sort_order);
