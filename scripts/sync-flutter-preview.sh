#!/usr/bin/env bash
# Rebuild Flutter UI preview and sync into public/app/ for Netlify.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STUDDLY_ROOT="${STUDDLY_ROOT:-$(cd "$ROOT/../studdly" && pwd)}"

if [[ ! -f "$STUDDLY_ROOT/lib/ui_preview_main.dart" ]]; then
  echo "Studdly app not found at $STUDDLY_ROOT (set STUDDLY_ROOT)" >&2
  exit 1
fi

echo "Building Flutter web preview from $STUDDLY_ROOT ..."
(
  cd "$STUDDLY_ROOT"
  flutter build web -t lib/ui_preview_main.dart --base-href /app/ --release --pwa-strategy=none --no-wasm-dry-run
)

echo "Syncing into $ROOT/public/app ..."
rm -rf "$ROOT/public/app"
mkdir -p "$ROOT/public/app"
rsync -a --delete --exclude '.last_build_id' "$STUDDLY_ROOT/build/web/" "$ROOT/public/app/"

echo "Done. Commit public/app/ and push to deploy."
