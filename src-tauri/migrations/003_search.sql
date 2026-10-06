-- Volltextsuche über Titel und Inhalt aller Seiten (FTS5).
-- rowid = pages.rid; Trigger halten den Index synchron, auch bei kaskadierendem Löschen.

CREATE VIRTUAL TABLE pages_fts USING fts5(
  title,
  body,
  tokenize = 'unicode61 remove_diacritics 2',
  prefix = '2 3'
);

INSERT INTO pages_fts (rowid, title, body)
SELECT p.rid, p.title, COALESCE(c.text, '')
FROM pages p LEFT JOIN page_content c ON c.page_id = p.id;

CREATE TRIGGER pages_fts_insert AFTER INSERT ON pages BEGIN
  INSERT INTO pages_fts (rowid, title, body) VALUES (new.rid, new.title, '');
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
