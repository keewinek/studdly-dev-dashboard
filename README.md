# Studdly Dev Dashboard

Public open-startup UI map for Studdly.

- **Live path:** `https://dev.studdly.app/ui`
- **Backup:** `https://studdlydev.netlify.app/ui` (same Netlify site)
- **Host:** Netlify free plan (static Vite SPA only)
- **Auth:** none — link is enough

## What `/ui` is

A pan/zoom map of **every** primary screen × **light/dark** × **all 6 languages**.

Layout:

- Columns = languages (English, Polski, Español, …)
- Within each column: **Light** block on top, **Dark** block below
- Each block = screenshot tiles grouped by flow (Onboarding, Home, …)

Hover a tile → **Open in new tab** → Flutter web preview with that `screen`, `theme`, `locale`, and `state`:

```
/app/?preview=1&screen=home&theme=dark&locale=pl&state=empty
```

If a screenshot fails on the latest commit, the map **keeps the previous PNG** and shows an **Outdated** badge (plus a top-bar warning).

## Automation (free Actions on public repo)

Heavy work runs on **this public repo** (`studdly-dev-dashboard`) so GitHub Actions minutes are free.
Private `studdly` only runs a tiny trigger (~seconds) on each `main` push.

Flow:

1. Push to `studdly` `main` → tiny workflow `trigger-ui-map.yml`  
2. That kicks off **Update UI map** here (public, free minutes)  
3. Checkout private Studdly → build Flutter `/app` → capture screenshots in locale×theme packs (e.g. `light.en`), pushing each pack live → final commit for leftover `/app` build  

4. Netlify rebuilds `https://dev.studdly.app` (backup: `https://studdlydev.netlify.app`)

### One-time setup (2 secrets)

Create **one** fine-grained PAT: https://github.com/settings/personal-access-tokens/new

| Field | Value |
|--------|--------|
| Token name | `studdly-ui-map-ci` |
| Expiration | your choice (e.g. 90 days) |
| Repository access | **Only select** → `studdly` **and** `studdly-dev-dashboard` |
| Permissions | **Contents → Read and write**, **Actions → Read and write** |

Generate → **copy the token once**.

Then add it in **two** places (same token value is fine):

1. **Public dashboard** → https://github.com/keewinek/studdly-dev-dashboard/settings/secrets/actions  
   - Name: `STUDDLY_REPO_TOKEN`  
   - Secret: paste token  

2. **Private Studdly** → https://github.com/keewinek/studdly/settings/secrets/actions  
   - Name: `UI_MAP_DISPATCH_TOKEN`  
   - Secret: paste same token  

You can delete the old `DASHBOARD_REPO_TOKEN` on Studdly if you added it earlier — it’s unused now.

### Run manually

- Dashboard: Actions → **Update UI map** → Run workflow  
- Or Studdly: Actions → **Trigger UI map update** → Run workflow  


## Develop

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

Optional: copy `.env.example` → `.env` and set `VITE_FLUTTER_PREVIEW_URL`.

## Screenshots (local)

```bash
# Terminal A — serve preview at /app/
mkdir -p /tmp/ui-preview-root/app && rsync -a public/app/ /tmp/ui-preview-root/app/
python3 -m http.server 7360 --directory /tmp/ui-preview-root

# Terminal B — capture screenshots
# Optional: COMMIT_EACH_PACK=1 pushes after each locale×theme pack (used in CI)
PREVIEW_BASE=http://127.0.0.1:7360/app/ npm run capture:screens

# Optional filters for faster local runs:
# LOCALE_FILTER=en THEME_FILTER=dark …
```

One PNG per frame (`/screens/{id}.png`). Zoom uses layout size (`--ms`), not CSS `scale()`, so chrome stays sharp; tiles load only when near the viewport.

Screen states come from Studdly (`lib/ui_preview/ui_preview_catalog.dart`), exported to `src/preview_catalog.json` — currently ~90 unique layouts × theme × locale. Add/remove screens there (+ wire `UiPreviewRegistry`), then re-export / re-run UI map CI.

Failed frames keep the previous file and set `stale` / `captureError` / `lastSuccessSha` / `lastSuccessAt` in `public/manifest.json`.
The map shows a caption under each shot (`relative time · short SHA`) and badges **Kept old** (capture failed), **Behind** (older successful SHA than the latest map run), or **Missing**.

## Flutter preview

Build + sync into this repo (or let CI do it):

```bash
./scripts/sync-flutter-preview.sh
# also refreshes src/preview_catalog.json from Studdly's ui_preview_catalog.dart
```

Or catalog only:

```bash
cd ../studdly && dart run tool/export_ui_preview_catalog.dart \
  --out ../studdly-dev-dashboard/src/preview_catalog.json
```

`VITE_FLUTTER_PREVIEW_URL` defaults to `/app/` (same origin).
