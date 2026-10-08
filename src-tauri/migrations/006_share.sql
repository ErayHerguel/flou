-- Zusammenarbeit: eingeladene Personen und ihre Rechte pro Seite.
-- Rechte gelten für die Seite und alle Unterseiten; die nächstgelegene Freigabe gewinnt
-- ('none' nimmt einen Teilbaum wieder aus).
CREATE TABLE share_members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  -- Geheimer Teil des Einladungslinks (256 Bit, hex).
  token TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE share_grants (
  member_id TEXT NOT NULL REFERENCES share_members(id) ON DELETE CASCADE,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('none', 'read', 'edit')),
  PRIMARY KEY (member_id, page_id)
);

CREATE INDEX share_grants_page ON share_grants(page_id);
