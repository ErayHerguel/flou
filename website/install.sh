#!/bin/bash
# Flou-Installer: lädt die aktuelle Version von GitHub, installiert sie nach /Applications und startet sie.
# Aufruf: curl -fsSL https://github.com/__REPO__/releases/latest/download/install.sh | bash
set -euo pipefail

REPO="__REPO__"
APP="/Applications/Flou.app"
URL="https://github.com/$REPO/releases/latest/download/Flou.dmg"

if [[ "$(uname -s)" != "Darwin" || "$(uname -m)" != "arm64" ]]; then
  echo "Flou benötigt einen Mac mit Apple Silicon (M1 oder neuer)." >&2
  exit 1
fi

if pgrep -x flou >/dev/null 2>&1; then
  echo "Flou läuft gerade. Bitte zuerst beenden (⌘Q) und den Befehl erneut ausführen." >&2
  exit 1
fi

TMP=$(mktemp -d)
MOUNT=""
cleanup() {
  [[ -n "$MOUNT" ]] && hdiutil detach "$MOUNT" -quiet >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

echo "Lade Flou …"
curl -fL --progress-bar "$URL" -o "$TMP/Flou.dmg"

MOUNT=$(hdiutil attach -nobrowse -readonly "$TMP/Flou.dmg" | tail -1 | awk -F'\t' '{print $NF}')
[[ -d "$MOUNT/Flou.app" ]] || { echo "Flou.app nicht im Download gefunden." >&2; exit 1; }

echo "Installiere nach $APP …"
rm -rf "$APP"
ditto "$MOUNT/Flou.app" "$APP"
xattr -cr "$APP"

echo "Fertig. Flou startet."
open "$APP"
