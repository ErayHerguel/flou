-- Eigene Geräte (z. B. das iPhone): voller Zugriff auf den ganzen Workspace, ohne Freigaben pro Seite.
ALTER TABLE share_members ADD COLUMN kind TEXT NOT NULL DEFAULT 'person' CHECK (kind IN ('person', 'device'));
