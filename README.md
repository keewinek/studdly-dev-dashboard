# Studdly Dev Dashboard

Public open-startup UI map for Studdly.

- **Live path:** `https://dev.studdly.app/ui`
- **Host:** Netlify (static Vite SPA)
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

## Screenshots

Until CI publishes real PNGs under `/public/screens/` + `/public/manifest.json`, the map generates the full catalog client-side and shows labeled placeholders when images 404.

Screenshot generation lives in the Flutter repo (`test/ui_catalog/` + CI), then assets are copied here for deploy.

## Flutter preview

Build + sync into this repo (deploys with Netlify):

```bash
./scripts/sync-flutter-preview.sh
git add public/app && git commit -m "Update Flutter UI preview" && git push
```

Or manually:

```bash
cd ../studdly
flutter build web -t lib/ui_preview_main.dart --base-href /app/ --release
rsync -a --delete --exclude '.last_build_id' build/web/ ../studdly-dev-dashboard/public/app/
```

Preview URLs look like:

```
https://dev.studdly.app/app/?preview=1&screen=home&theme=dark&locale=pl&state=empty
```

`VITE_FLUTTER_PREVIEW_URL` defaults to `/app/` (same origin). Override in Netlify env only if the preview is hosted elsewhere.