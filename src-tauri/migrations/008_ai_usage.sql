-- Protokoll der KI-Anfragen für die Kostenübersicht. Enthält nur Zahlen, keine Inhalte.
CREATE TABLE ai_usage (
  id INTEGER PRIMARY KEY,
  created_at INTEGER NOT NULL,
  feature TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cache_write_tokens INTEGER NOT NULL DEFAULT 0,
  web_searches INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ok'
);
CREATE INDEX ai_usage_created ON ai_usage(created_at);
