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

Build the web preview entry from the Studdly app:

```bash
flutter build web -t lib/ui_preview_main.dart --base-href /app/
```

Deploy the `build/web` output to Netlify under `/app/` (or set `VITE_FLUTTER_PREVIEW_URL` to that host).
