# Studdly Dev Dashboard

Public open-startup UI map for Studdly.

- **Live path:** `https://studdlydev.netlify.app/ui`
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

## Automation (free)

Netlify free only builds this Vite site. Flutter + Playwright run on **GitHub Actions** in the Studdly repo (free minutes), then push assets here.

Flow:

1. Push to `studdly` `main` → workflow `.github/workflows/update-ui-map.yml`
2. Build Flutter web UI preview → sync into `public/app/`
3. Capture 1× + 2× screenshots (fail-soft: keep old PNGs, mark `stale` in `manifest.json`)
4. Commit + push this repo → Netlify rebuilds `https://studdlydev.netlify.app`

### One-time setup: `DASHBOARD_REPO_TOKEN`

In the **Studdly** GitHub repo → Settings → Secrets and variables → Actions, add:

| Secret | Value |
|--------|--------|
| `DASHBOARD_REPO_TOKEN` | Fine-grained PAT (or classic) with **Contents: Read and write** on `keewinek/studdly-dev-dashboard` |

Without this secret, the workflow cannot push screenshot/preview updates.

You can also run the workflow manually: Actions → **Update UI map** → Run workflow.

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

# Terminal B — 1× / 2× / 4× (4× = crisp zoom-in on retina)
PREVIEW_BASE=http://127.0.0.1:7360/app/ npm run capture:screens
PREVIEW_BASE=http://127.0.0.1:7360/app/ npm run capture:screens:2x
PREVIEW_BASE=http://127.0.0.1:7360/app/ npm run capture:screens:4x

# Optional filters for faster local runs:
# LOCALE_FILTER=en THEME_FILTER=dark …
```

The map swaps textures by zoom × devicePixelRatio: **1×** overview → **2×** mid → **4×** (~1560×3376, near-4K) when zoomed in.

Screen states are generated algorithmically from `src/catalog-spec.ts` (scroll positions, overlays, empty/full, CTA chrome, …) — currently ~90 unique layouts × theme × locale.

Failed frames keep the previous file and set `stale` / `captureError` / `lastSuccessSha` in `public/manifest.json`.

## Flutter preview

Build + sync into this repo (or let CI do it):

```bash
./scripts/sync-flutter-preview.sh
```

`VITE_FLUTTER_PREVIEW_URL` defaults to `/app/` (same origin).
