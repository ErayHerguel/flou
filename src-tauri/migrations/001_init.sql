CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- rid ist ein stabiler Integer-Schlüssel (VACUUM-fest), der als rowid für die Volltextsuche dient.
CREATE TABLE pages (
  rid INTEGER PRIMARY KEY,
  id TEXT NOT NULL UNIQUE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES pages(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'page' CHECK (type IN ('page', 'database')),
  title TEXT NOT NULL DEFAULT '',
  icon TEXT,
  cover TEXT,
  full_width INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);

CREATE INDEX pages_parent ON pages(parent_id, sort_order);
CREATE INDEX pages_deleted ON pages(deleted_at);

CREATE TABLE page_content (
  page_id TEXT PRIMARY KEY REFERENCES pages(id) ON DELETE CASCADE,
  doc TEXT NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL
);

CREATE TABLE page_links (
  source_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  PRIMARY KEY (source_id, target_id)
) WITHOUT ROWID;

CREATE INDEX page_links_target ON page_links(target_id);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO workspaces (id, name, created_at)
VALUES ('default', 'Mein Workspace', CAST(strftime('%s', 'now') AS INTEGER) * 1000);
