# Flou

Lokale Notizen und Datenbanken für macOS (Apple Silicon): schnell, tastaturfreundlich, vollständig offline.
Kein Konto, kein Server, keine Telemetrie. Alle Daten liegen auf deinem Mac.

## Funktionen

- **Seiten** in beliebiger Verschachtelung, Drag-and-drop in der Seitenleiste, Papierkorb mit Wiederherstellen
- **Block-Editor**: Absatz, Überschriften, Listen, To-dos, Toggle, Zitat, Callout, Code mit Syntax-Highlighting, Trenner, Bilder, Unterseiten
- **Slash-Menü** (`/`) mit Fuzzy-Suche, **Markdown-Shortcuts** beim Tippen, schwebende Formatierungsleiste
- **Seitenlinks** mit `[[` und Backlinks am Seitenende
- **Datenbanken** mit Text, Zahl, Auswahl, Mehrfachauswahl, Datum, Checkbox und URL. Ansichten als Tabelle und Kanban-Board; Filter, Sortierung und Spaltenbreiten werden pro Ansicht gespeichert
- **Befehlspalette** (`⌘K`) und **Volltextsuche** (SQLite FTS5)
- **Markdown-Export und -Import** (einzelne Seiten, ganzer Workspace, Ordner)
- **Automatisches Backup**: täglich, die letzten 7 bleiben erhalten
- Helles, dunkles und System-Theme; Autosave ohne Speichern-Knopf

## Voraussetzungen

- macOS 13 oder neuer auf Apple Silicon
- Xcode Command Line Tools: `xcode-select --install`
- Rust (stable) über [rustup](https://rustup.rs) mit dem Ziel `aarch64-apple-darwin`
- Node.js 20 oder neuer und npm

Die npm-Skripte ergänzen `~/.cargo/bin` automatisch im `PATH`. Rust muss also nicht global im Terminal eingerichtet sein.

## Entwicklung

```bash
npm install
npm run tauri dev
```

Das startet Vite auf Port 1420 und die App mit Hot Reload.

Tests und Prüfungen:

```bash
npm test             # Vitest: Logik, Datenbank (echtes SQLite), Editor, Performance
npm run cargo-test   # Rust-Tests (Export-Pfade, Import, Backup-Rotation)
npm run build        # TypeScript-Prüfung und Frontend-Build
npm run cargo-check  # Rust-Prüfung
npm run licenses     # Lizenzen aller ausgelieferten Pakete prüfen
```

## Bauen

```bash
npm run build:mac
```

Das ist `npm run tauri build` für `aarch64-apple-darwin`. Ergebnis:

- App: `src-tauri/target/aarch64-apple-darwin/release/bundle/macos/Flou.app`
- DMG: `src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/Flou_1.0.0_aarch64.dmg`

Die App ist ad-hoc signiert, nicht mit einer Apple-Developer-ID. Beim DMG-Bau ordnet macOS das Fenster über den Finder an; beim ersten Mal kann dafür eine Rückfrage zur Finder-Steuerung erscheinen.

Smoke-Test des fertigen Builds (Bundle-ID, Architektur, Signatur, Start, Migrationen, Volltextsuche, Kaltstartzeit; läuft mit einem temporären Datenordner):

```bash
npm run smoke
```

## Installieren

```bash
npm run install-mac
```

Kopiert `Flou.app` nach `/Applications` und entfernt das Quarantäne-Flag (`xattr -cr`). Danach startet die App per Doppelklick ohne Gatekeeper-Warnung. Läuft Flou gerade, bricht das Skript ab, damit nichts verloren geht.

Alternativ das DMG öffnen und Flou in den Programme-Ordner ziehen. Weil die App nicht notariell beglaubigt ist, braucht es dann einmalig Rechtsklick → Öffnen, oder:

```bash
xattr -cr /Applications/Flou.app
```

## Datenordner

```
~/Library/Application Support/app.flou.desktop/
├── flou.db          SQLite-Datenbank (WAL-Modus): Seiten, Inhalte, Datenbanken, Einstellungen
├── flou.db-wal/-shm Schreibprotokoll von SQLite, gehört zur Datenbank
├── assets/          Bilder, benannt nach ihrem Inhalts-Hash
└── backups/         tägliche Backups, je ein Ordner pro Tag
```

In der App: Menü „Hilfe → Datenordner im Finder zeigen“.

Alle Schreibvorgänge laufen in Transaktionen. Schlägt ein Speichern fehl, bleiben die Änderungen in der Warteschlange und werden erneut versucht. Beim Beenden wird gewartet, bis alles geschrieben ist.

## Backup und Restore

**Automatisch:** Kurz nach dem Start und danach stündlich prüft Flou, ob es für heute schon ein Backup gibt. Falls nicht, entsteht `backups/JJJJ-MM-TT/` mit einer konsistenten Kopie der Datenbank (`VACUUM INTO`) und den Bildern. Es bleiben immer die 7 neuesten Backups erhalten.

**Manuell:** Befehlspalette (`⌘K`) → „Backup jetzt erstellen“ oder Menü „Hilfe → Backup jetzt erstellen“.

**Wiederherstellen:**

1. Flou beenden (`⌘Q`).
2. Den aktuellen Stand sichern:
   ```bash
   cd ~/Library/Application\ Support/app.flou.desktop
   mkdir -p ~/Desktop/flou-vorher && cp -R flou.db* assets ~/Desktop/flou-vorher/
   ```
3. Das gewünschte Backup zurückkopieren (Datum anpassen):
   ```bash
   cd ~/Library/Application\ Support/app.flou.desktop
   rm -f flou.db-wal flou.db-shm
   cp backups/2026-10-06/flou.db flou.db
   cp -R backups/2026-10-06/assets/. assets/
   ```
4. Flou starten.

Zusätzlich bietet der Markdown-Export (`⇧⌘E` für eine Seite, „Workspace als Markdown exportieren …“ für alles) eine lesbare Kopie unabhängig von Flou.

## Tastenkürzel (Auswahl)

| Aktion | Kürzel |
| --- | --- |
| Befehlspalette | `⌘K` |
| Volltextsuche | `⇧⌘F` |
| Neue Seite / Unterseite / Datenbank | `⌘N` / `⇧⌘N` / `⌥⌘N` |
| Seitenleiste | `⌘\` |
| Seite umbenennen | `⇧⌘R` |
| In den Papierkorb | `⇧⌘⌫` |
| Zurück / Vorwärts | `⌘[` / `⌘]` |
| Block verschieben | `⇧⌘↑` / `⇧⌘↓` |
| Link setzen | `⇧⌘K` |
| Seite exportieren | `⇧⌘E` |
| Alle Kürzel | `⌘/` |

## Umbenennen

Der Name steht an drei Stellen:

- `src/app.config.ts` (`APP_NAME`, Datenbankname)
- `src-tauri/tauri.conf.json` (`productName`, `identifier`, Fenstertitel)
- `src-tauri/src/paths.rs` (Datenbankdatei)

Das Logo entsteht aus `scripts/make-icon.mjs`; `npm run icons` erzeugt alle Icon-Größen neu.

## Projektstruktur

```
src/                 React-Frontend
  db/                Datenzugriff: Treiber, Repositories, Speicher-Warteschlange, Suche
  store/             Zustand-Stores (Seiten, Datenbanken, Oberfläche)
  editor/            TipTap-Editor, eigene Blöcke, Slash-Menü, Greifer
  features/          Seitenleiste, Seitenansicht, Datenbanken, Palette, Export/Import
  lib/               Baumlogik, Fuzzy-Suche, Markdown
src-tauri/           Rust-Shell
  migrations/        SQL-Migrationen
  src/               Transaktionen, Bilder, Backups, Export/Import
scripts/             Icon, Installation, Smoke-Test, Lizenzprüfung
brand/               Logo (SVG)
```

## Datenschutz und Netzwerk

Flou macht zur Laufzeit keine Netzwerkanfragen. Die Content-Security-Policy erlaubt nur lokale Ressourcen. Externe Bilder in eingefügtem HTML werden nicht übernommen, Schriften sind eingebunden. Links öffnen sich nur auf ausdrücklichen ⌘-Klick im Standardbrowser.

## Lizenzen der Abhängigkeiten

`npm run licenses` prüft alle ausgelieferten npm-Pakete und Rust-Crates. Fast alles steht unter MIT, Apache-2.0, MPL-2.0 oder BSD. Ausnahmen, alle freizügig und kostenlos:

- **Inter**: SIL Open Font License
- **lucide-react**: ISC
- **tslib**: 0BSD
- Einige Crates, die Tauri selbst mitbringt (ICU, zlib-rs, foldhash): Unicode-3.0 bzw. Zlib

`argparse` (PSF-2.0) wird nur vom Kommandozeilen-Werkzeug von markdown-it genutzt und landet nicht im App-Bundle; der Lizenz-Check prüft das am Build.
