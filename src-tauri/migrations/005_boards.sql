-- Whiteboards (Excalidraw-Szenen). Eine Seite mit Eintrag hier ist ein Board.
-- (pages.type lässt sich wegen der Fremdschlüssel nicht gefahrlos erweitern; das Board-Merkmal liegt deshalb hier.)
CREATE TABLE boards (
  page_id TEXT PRIMARY KEY REFERENCES pages(id) ON DELETE CASCADE,
  -- {"elements": [...], "files": {fileId: {"asset": "...", "mimeType": "..."}}, "appState": {...}}
  scene TEXT NOT NULL DEFAULT '{"elements":[],"files":{}}',
  updated_at INTEGER NOT NULL
);
