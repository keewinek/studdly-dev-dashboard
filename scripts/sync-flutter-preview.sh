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

# Ensure stale PWAs are cleared for deep-link reliability.
INDEX_HTML="$ROOT/public/app/index.html" python3 - <<'PY'
from pathlib import Path
import os
p = Path(os.environ['INDEX_HTML'])
text = p.read_text()
snippet = """  <script>
    // Drop stale Flutter PWAs so deep-link previews always load the latest build.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const reg of regs) reg.unregister();
      }).catch(() => {});
    }
  </script>
"""
needle = '  <script src="flutter_bootstrap.js" async></script>'
if 'Drop stale Flutter PWAs' not in text and needle in text:
    text = text.replace(needle, snippet + needle)
    p.write_text(text)
    print('patched index.html service-worker cleanup')
else:
    print('index.html already patched or needle missing')
PY

echo "Done. Commit public/app/ and push to deploy."
