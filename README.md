# Studdly Dev Dashboard

Public open-startup UI map for Studdly.

- **Live path:** `https://dev.studdly.app/ui`
- **Stats:** `https://dev.studdly.app/stats`
- **Backup:** `https://studdlydev.netlify.app/ui` (same Netlify site)
- **Host:** Netlify free plan (static Vite SPA + one downloads function)
- **Auth:** none — link is enough

## What `/stats` is

Exact lifetime download counts for Studdly — not Play Console “10K+” buckets and not the fuzzy App Store Connect charts.

| Store | Metric | Source |
|--------|--------|--------|
| Google Play | **Total user installs** | Play Console Cloud Storage `stats/installs/…_overview.csv` |
| App Store | **First-time downloads** (Sales `Units`) | [App Store Connect Sales Reports API](https://developer.apple.com/documentation/appstoreconnectapi/get-v1-salesreports) |

Live page: [https://dev.studdly.app/stats](https://dev.studdly.app/stats)

The page loads `/api/downloads` (Netlify Function). If credentials aren’t set yet, it falls back to `public/stats.json` and shows `—`.

---

### Stats setup tutorial (do this once)

You need **3 things**: Google Play access, App Store Connect access, then paste secrets into Netlify.  
Keep a notes file open and copy each value as you go.

#### Part A — Google Play (exact Android installs)

**A1. Create a Google Cloud service account + JSON key**

1. Open [Google Cloud Console → create project](https://console.cloud.google.com/projectcreate) (or pick an existing project).
2. Open [Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts) → **Create service account**.
3. Name it e.g. `studdly-play-stats` → **Create and continue** → skip optional roles → **Done**.
4. Click the new account → **Keys** → **Add key** → **Create new key** → **JSON** → **Create**.  
   A `.json` file downloads — **keep it safe** (this is a secret).
5. Copy the service account **email** (looks like `studdly-play-stats@….iam.gserviceaccount.com`).

Official-style walkthrough (same clicks): [Expo: creating a Google service account](https://github.com/expo/fyi/blob/main/creating-google-service-account.md).

**A2. Invite that email into Play Console**

1. Open [Play Console → Users and permissions](https://play.google.com/console/users-and-permissions).
2. **Invite new users** → paste the service account email.
3. Permissions (enough for stats reports):
   - **View app information** (set to **Global** / all apps, or at least Studdly)
   - If asked: anything related to **view statistics / download reports**
4. Send invite / save.

Google’s note: Cloud Storage report access follows Play Console permissions — see [Download and export monthly reports](https://support.google.com/googleplay/android-developer/answer/6135870).

**A3. Copy your Play Cloud Storage bucket name**

1. Open [Play Console](https://play.google.com/console/).
2. Go to **Download reports** (left menu; sometimes under **Download reports** → **Statistics**).  
   Direct help article: [Download and export monthly reports](https://support.google.com/googleplay/android-developer/answer/6135870).
3. Find **Statistics** / installs section → click **Copy Cloud Storage URI**.
4. You get something like:  
   `gs://pubsite_prod_rev_01234567890987654321/stats/installs/`  
5. For Netlify, set only the bucket part:  
   `PLAY_GCS_BUCKET=pubsite_prod_rev_01234567890987654321`  
   (no `gs://`, no path after the bucket name)

**A4. Values to save for Play**

| Env var | Where it comes from |
|---------|---------------------|
| `PLAY_GCS_BUCKET` | Bucket name from A3 |
| `PLAY_SERVICE_ACCOUNT_JSON` | Entire contents of the downloaded `.json` file (one line is fine) |
| `PLAY_PACKAGE_NAME` | `com.studdly.app` (optional; this is already the default) |

---

#### Part B — App Store Connect (exact iOS downloads)

Apple overview: [Creating API Keys for App Store Connect API](https://developer.apple.com/documentation/appstoreconnectapi/creating-api-keys-for-app-store-connect-api) · Help: [App Store Connect API](https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-api)

**Important:** Use a **Team** key (not Individual). Individual keys cannot access Sales reports.

**B1. Create the API key**

1. Open [App Store Connect → Users and Access → Integrations → App Store Connect API](https://appstoreconnect.apple.com/access/integrations/api)  
   (Account Holder / Admin required.)
2. Under **Team Keys**, click **+** to generate a key.
3. Name: e.g. `Studdly Stats`.
4. Access / role: pick one that includes **Sales and Reports** (Finance or Admin is safest).
5. Click **Generate**.
6. **Download** the `.p8` file **now** — Apple only lets you download it once.
7. On the same page, copy:
   - **Issuer ID** (UUID at the top of the keys page)
   - **Key ID** (for this key)

**B2. Find your Vendor Number**

1. Open [App Store Connect → Payments and Financial Reports / Reports](https://appstoreconnect.apple.com/itc/payments_and_financial_reports)  
   (or top nav **Payments and Financial Reports** → **Reports**).
2. Top-left under your legal entity name you’ll see **Vendor # 12345678**.  
   Official steps: [View payments and proceeds → View your vendor number](https://developer.apple.com/help/app-store-connect/getting-paid/view-payments-and-proceeds/).

**B3. Values to save for Apple**

| Env var | Where it comes from |
|---------|---------------------|
| `ASC_ISSUER_ID` | Issuer ID from B1 |
| `ASC_KEY_ID` | Key ID from B1 |
| `ASC_PRIVATE_KEY` | Full text of the `.p8` file (including `BEGIN` / `END` lines). In Netlify UI, replace real newlines with `\n` |
| `ASC_VENDOR_NUMBER` | Vendor # from B2 |
| `ASC_APPLE_ID` | `6755741754` (optional; Studdly’s App Store ID) |
| `ASC_START_YEAR` | `2025` (optional; first year Studdly was on the store) |

---

#### Part C — Paste into Netlify (so `/stats` can read them live)

Netlify docs: [Environment variables](https://docs.netlify.com/build/configure-builds/environment-variables/)

1. Open [Netlify Dashboard](https://app.netlify.com/) → your **studdlydev** / `dev.studdly.app` site.
2. **Site configuration** → **Environment variables** → **Add a variable** (or **Add multiple**).
3. Add every var from the tables above (`PLAY_*` and `ASC_*`).  
   Mark secrets as **Secret** if Netlify offers that.
4. **Scopes:** enable at least **Production** (Functions need them at runtime).
5. Trigger a redeploy: **Deploys** → **Trigger deploy** → **Deploy site**  
   (or push any small commit). Env vars for Functions apply after the next deploy/restart.

Then open [https://dev.studdly.app/stats](https://dev.studdly.app/stats) — you should see real numbers within ~1 hour cache (refresh hard if needed).

---

#### Optional — test on your Mac first

1. Copy [`.env.example`](.env.example) → `.env`
2. Fill the same `PLAY_*` / `ASC_*` values
3. Run:

```bash
npm run stats:fetch
```

This writes `public/stats.json`. If numbers look right, your credentials work (then still do Part C for the live API).

---

## What `/ui` is

A pan/zoom map of **every** primary screen × **light/dark** × **all 6 languages**.

Layout:

- Columns = languages (English, Polski, Español, …)
- Within each column: **Light** block on top, **Dark** block below
- Each block = screenshot tiles grouped by flow (Onboarding, Home, …)

Hover a tile (or tap it on mobile) → **Open** → Flutter web preview with that `screen`, `theme`, `locale`, and `state`:

```
/app/?preview=1&screen=home&theme=dark&locale=pl&state=empty
```

If a screenshot fails on the latest commit, the map **keeps the previous PNG** and shows an **Outdated** badge (plus a top-bar warning).

Map tiles load **WebP thumbs** (`/screens/thumbs/*.webp`); full PNGs stay at `/screens/*.png` for reference. Regenerate with `npm run thumbs:screens`.

## Automation (free Actions on public repo)

Heavy work runs on **this public repo** (`studdly-dev-dashboard`) so GitHub Actions minutes are free.
Private `studdly` only runs a tiny trigger (~seconds) when **UI-preview paths** change on `main`
(or via manual dispatch) — not on every Studdly push.

Flow:

1. Push to `studdly` `main` that touches `lib/ui_preview/**` (or related paths) → tiny workflow `trigger-ui-map.yml`  
   - Or: Actions → **Trigger UI map update** / **Update UI map** → Run workflow (any Studdly SHA)  
2. That kicks off **Update UI map** here (public, free minutes)  
3. Checkout private Studdly → build Flutter `/app` → capture screenshots in locale×theme packs (e.g. `light.en`), pushing each pack as a git checkpoint (`[skip netlify]`) → **one** final leftovers/deploy commit  
4. Netlify rebuilds `https://dev.studdly.app` **once** per successful run (backup: `https://studdlydev.netlify.app`)

Pack commits and the early `/app` push use `[skip netlify]` so intermediate pushes do not burn Netlify build minutes. The live map updates when the final deploy commit lands (all packs + `/app` together).

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
# Optional: COMMIT_EACH_PACK=1 pushes after each locale×theme pack (used in CI;
# pack commits include [skip netlify] — live deploy is the final CI commit)
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
