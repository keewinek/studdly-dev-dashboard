#!/usr/bin/env bash
# Rebuild Flutter UI preview and sync into public/app/ for Netlify.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STUDDLY_ROOT="${STUDDLY_ROOT:-$(cd "$ROOT/../studdly" && pwd)}"

if [[ ! -f "$STUDDLY_ROOT/lib/ui_preview_main.dart" ]]; then
  echo "Studdly app not found at $STUDDLY_ROOT (set STUDDLY_ROOT)" >&2
  exit 1
fi

if [[ "${SKIP_BUILD:-0}" == "1" ]]; then
  echo "SKIP_BUILD=1 — using existing $STUDDLY_ROOT/build/web"
  if [[ ! -d "$STUDDLY_ROOT/build/web" ]]; then
    echo "Missing $STUDDLY_ROOT/build/web (build Flutter first)" >&2
    exit 1
  fi
else
  echo "Building Flutter web preview from $STUDDLY_ROOT ..."
  (
    cd "$STUDDLY_ROOT"
    flutter build web -t lib/ui_preview_main.dart --base-href /app/ --release --pwa-strategy=none --no-wasm-dry-run --no-tree-shake-icons
  )
fi

echo "Syncing into $ROOT/public/app ..."
rm -rf "$ROOT/public/app"
mkdir -p "$ROOT/public/app"
rsync -a --delete --exclude '.last_build_id' "$STUDDLY_ROOT/build/web/" "$ROOT/public/app/"

if [[ "${SKIP_CATALOG_EXPORT:-0}" == "1" ]]; then
  echo "SKIP_CATALOG_EXPORT=1 — leaving preview_catalog.json as-is"
else
  echo "Exporting UI preview catalog from Studdly ..."
  (
    cd "$STUDDLY_ROOT"
    dart run tool/export_ui_preview_catalog.dart --out "$ROOT/src/preview_catalog.json"
    dart run tool/export_ui_preview_catalog.dart --out "$ROOT/public/preview_catalog.json"
  )
fi

# Ensure stale PWAs are cleared for deep-link reliability.
INDEX_HTML="$ROOT/public/app/index.html" python3 - <<'PY'
from pathlib import Path
import os
p = Path(os.environ['INDEX_HTML'])
text = p.read_text()
snippet = """  <script>
    // Clear stale Flutter service workers/caches before bootstrapping.
    (async function () {
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
        if (window.caches) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch (_) {}
      const s = document.createElement('script');
      s.src = 'flutter_bootstrap.js';
      s.async = true;
      document.body.appendChild(s);
    })();
  </script>
"""
# Remove previous bootstrap + old cleanup so we own load order.
import re
text = re.sub(
    r"\s*<script>\s*// Drop stale Flutter PWAs[\s\S]*?</script>\s*",
    "\n",
    text,
)
text = re.sub(
    r"\s*<script>\s*// Clear stale Flutter service workers[\s\S]*?</script>\s*",
    "\n",
    text,
)
text = text.replace(
    '  <script src="flutter_bootstrap.js" async></script>\n',
    '',
)
if '</body>' in text:
    text = text.replace('</body>', snippet + '</body>')
    p.write_text(text)
    print('patched index.html service-worker cleanup + deferred bootstrap')
else:
    print('index.html missing </body>')
PY

echo "Done. Commit public/app/ and push to deploy."
