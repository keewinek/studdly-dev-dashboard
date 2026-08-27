/**
 * Exact download totals from Google Play Console exports + App Store Connect Sales API.
 * Used by Netlify function and `npm run stats:fetch`.
 */

import crypto from 'node:crypto'
import { gunzipSync } from 'node:zlib'

export const PACKAGE_NAME = process.env.PLAY_PACKAGE_NAME || 'com.studdly.app'
export const APPLE_ID = process.env.ASC_APPLE_ID || '6755741754'

const PLAY_URL = `https://play.google.com/store/apps/details?id=${PACKAGE_NAME}`
const APPLE_URL = `https://apps.apple.com/app/id${APPLE_ID}`

/**
 * @typedef {{ platform: 'google_play' | 'app_store', label: string, downloads: number | null, metric: string, through?: string, note?: string, storeUrl: string }} StoreDownloads
 * @typedef {{ generatedAt: string, source: 'live' | 'cached' | 'static' | 'unconfigured', packageName: string, appleId: string, total: number | null, stores: StoreDownloads[], setup?: string[] }} DownloadsSnapshot
 */

function b64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function parseServiceAccount(raw) {
  if (!raw) return null
  const text = raw.includes('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')
  return JSON.parse(text)
}

async function googleAccessToken(sa, scopes) {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: scopes.join(' '),
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  )
  const unsigned = `${header}.${claim}`
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(unsigned)
  const sig = b64url(signer.sign(sa.private_key))
  const assertion = `${unsigned}.${sig}`

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  })
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    throw new Error(`Google token failed: ${res.status} ${await res.text()}`)
  }
  const json = await res.json()
  return json.access_token
}

function parseCsv(text) {
  // Play reports are UTF-16; Apple are UTF-8 TSV.
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n').filter((l) => l.trim().length)
  if (!lines.length) return { headers: [], rows: [] }
  const delim = lines[0].includes('\t') ? '\t' : ','
  const split = (line) => {
    const out = []
    let cur = ''
    let inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"'
          i++
        } else inQ = !inQ
        continue
      }
      if (ch === delim && !inQ) {
        out.push(cur)
        cur = ''
        continue
      }
      cur += ch
    }
    out.push(cur)
    return out
  }
  const headers = split(lines[0]).map((h) => h.trim())
  const rows = lines.slice(1).map((line) => {
    const cols = split(line)
    /** @type {Record<string, string>} */
    const obj = {}
    headers.forEach((h, i) => {
      obj[h] = (cols[i] ?? '').trim()
    })
    return obj
  })
  return { headers, rows }
}

function decodePlayCsv(buf) {
  // Play Console CSVs are UTF-16LE (sometimes UTF-8).
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return buf.toString('utf16le')
  }
  // Heuristic: lots of null bytes → UTF-16LE without BOM
  let nulls = 0
  const sample = Math.min(buf.length, 200)
  for (let i = 0; i < sample; i++) if (buf[i] === 0) nulls++
  if (nulls > sample / 4) return buf.toString('utf16le')
  return buf.toString('utf8')
}

/**
 * Lifetime Total User Installs from the latest overview installs export.
 * @returns {Promise<StoreDownloads>}
 */
export async function fetchGooglePlayDownloads() {
  const sa = parseServiceAccount(process.env.PLAY_SERVICE_ACCOUNT_JSON)
  const bucket = process.env.PLAY_GCS_BUCKET
  if (!sa || !bucket) {
    return {
      platform: 'google_play',
      label: 'Google Play',
      downloads: null,
      metric: 'Total user installs',
      storeUrl: PLAY_URL,
      note: 'Missing PLAY_SERVICE_ACCOUNT_JSON and/or PLAY_GCS_BUCKET',
    }
  }

  const token = await googleAccessToken(sa, [
    'https://www.googleapis.com/auth/devstorage.read_only',
  ])

  const prefix = `stats/installs/installs_${PACKAGE_NAME}_`
  const listUrl = new URL(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o`)
  listUrl.searchParams.set('prefix', prefix)
  listUrl.searchParams.set('maxResults', '1000')

  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!listRes.ok) {
    throw new Error(`Play GCS list failed: ${listRes.status} ${await listRes.text()}`)
  }
  const list = await listRes.json()
  const items = (list.items || [])
    .map((o) => o.name)
    .filter((n) => n.includes('_overview.csv') || /installs_.*_\d{6}\.csv$/.test(n))
    .sort()

  if (!items.length) {
    return {
      platform: 'google_play',
      label: 'Google Play',
      downloads: null,
      metric: 'Total user installs',
      storeUrl: PLAY_URL,
      note: `No install CSVs under gs://${bucket}/${prefix}*`,
    }
  }

  // Prefer overview dimension; fall back to latest monthly file.
  const overview = items.filter((n) => n.includes('_overview.csv'))
  const target = (overview.length ? overview : items).at(-1)

  const mediaUrl = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(target)}?alt=media`
  const fileRes = await fetch(mediaUrl, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!fileRes.ok) {
    throw new Error(`Play GCS download failed: ${fileRes.status} ${await fileRes.text()}`)
  }
  const buf = Buffer.from(await fileRes.arrayBuffer())
  const { rows } = parseCsv(decodePlayCsv(buf))

  const totalKey =
    rows[0] &&
    Object.keys(rows[0]).find((k) => /^total user installs$/i.test(k))
  const dailyKey =
    rows[0] &&
    Object.keys(rows[0]).find((k) => /^daily user installs$/i.test(k))
  const dateKey = rows[0] && Object.keys(rows[0]).find((k) => /^date$/i.test(k))

  let downloads = null
  let through = undefined

  if (totalKey) {
    // Cumulative column — take the last non-empty value.
    for (let i = rows.length - 1; i >= 0; i--) {
      const raw = rows[i][totalKey]
      const n = Number(String(raw).replace(/,/g, ''))
      if (Number.isFinite(n)) {
        downloads = n
        if (dateKey && rows[i][dateKey]) through = normalizePlayDate(rows[i][dateKey])
        break
      }
    }
  } else if (dailyKey) {
    // Sum daily new user installs across available months (approximate lifetime if history complete).
    let sum = 0
    for (const row of rows) {
      const n = Number(String(row[dailyKey]).replace(/,/g, ''))
      if (Number.isFinite(n)) sum += n
      if (dateKey && row[dateKey]) through = normalizePlayDate(row[dateKey])
    }
    downloads = sum
  }

  return {
    platform: 'google_play',
    label: 'Google Play',
    downloads,
    metric: totalKey ? 'Total user installs' : 'Sum of daily user installs',
    through,
    storeUrl: PLAY_URL,
    note: downloads == null ? `Could not parse ${target}` : undefined,
  }
}

function normalizePlayDate(raw) {
  // YYYYMMDD or YYYY-MM-DD
  const s = String(raw).trim()
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T00:00:00.000Z`
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return `${s.slice(0, 10)}T00:00:00.000Z`
  return undefined
}

function appleJwt() {
  const issuerId = process.env.ASC_ISSUER_ID
  const keyId = process.env.ASC_KEY_ID
  let privateKey = process.env.ASC_PRIVATE_KEY
  if (!issuerId || !keyId || !privateKey) return null
  privateKey = privateKey.replace(/\\n/g, '\n')
  if (!privateKey.includes('BEGIN')) {
    privateKey = Buffer.from(privateKey, 'base64').toString('utf8')
  }

  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }))
  const payload = b64url(
    JSON.stringify({
      iss: issuerId,
      iat: now,
      exp: now + 20 * 60,
      aud: 'appstoreconnect-v1',
    }),
  )
  const unsigned = `${header}.${payload}`
  const keyObj = crypto.createPrivateKey(privateKey)
  const sig = crypto.sign('sha256', Buffer.from(unsigned), {
    key: keyObj,
    dsaEncoding: 'ieee-p1363',
  })
  return `${unsigned}.${b64url(sig)}`
}

async function downloadAppleSalesReport({ token, vendorNumber, frequency, reportDate }) {
  const url = new URL('https://api.appstoreconnect.apple.com/v1/salesReports')
  url.searchParams.set('filter[frequency]', frequency)
  url.searchParams.set('filter[reportType]', 'SALES')
  url.searchParams.set('filter[reportSubType]', 'SUMMARY')
  url.searchParams.set('filter[vendorNumber]', vendorNumber)
  url.searchParams.set('filter[version]', '1_0')
  if (reportDate) url.searchParams.set('filter[reportDate]', reportDate)

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/a-gzip',
    },
  })
  if (res.status === 404) return null
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`App Store salesReports ${frequency} ${reportDate || ''}: ${res.status} ${text}`)
  }
  const gz = Buffer.from(await res.arrayBuffer())
  const text = gunzipSync(gz).toString('utf8')
  return parseCsv(text)
}

function sumAppleUnits(parsed, appleId) {
  if (!parsed) return { units: 0, sku: null }
  const skuHints = new Set(
    [process.env.ASC_SKU, PACKAGE_NAME, 'studdly', 'Studdly']
      .filter(Boolean)
      .map((s) => String(s).toLowerCase()),
  )
  let units = 0
  let matched = 0
  for (const row of parsed.rows) {
    const appleIdCol = row['Apple Identifier'] || row['appleIdentifier'] || ''
    const sku = (row['SKU'] || row['sku'] || '').toLowerCase()
    const title = (row['Title'] || row['title'] || '').toLowerCase()
    const productType = row['Product Type Identifier'] || row['productTypeIdentifier'] || ''
    // App download product types: 1 (iOS), 1-B, F1, etc. Skip IAP (FI*, IA*).
    const isApp =
      productType === '1' ||
      productType === '1-B' ||
      productType === 'F1' ||
      /^1/.test(productType)

    if (!isApp) continue

    const idMatch = appleId && String(appleIdCol) === String(appleId)
    const skuMatch = sku && skuHints.has(sku)
    const titleMatch = title.includes('studdly')
    if (!idMatch && !skuMatch && !titleMatch && appleId) {
      // If we have an Apple ID filter, require match; if row has no id, skip.
      if (appleIdCol) continue
    }

    const u = Number(String(row['Units'] || row['units'] || '0').replace(/,/g, ''))
    if (Number.isFinite(u)) {
      units += u
      matched++
    }
  }
  return { units, matched }
}

/**
 * Lifetime App Store app units (first-time downloads for free apps).
 * Prefers yearly SALES summaries; falls back to monthly for years without a yearly file.
 * @returns {Promise<StoreDownloads>}
 */
export async function fetchAppStoreDownloads() {
  const token = appleJwt()
  const vendorNumber = process.env.ASC_VENDOR_NUMBER
  if (!token || !vendorNumber) {
    return {
      platform: 'app_store',
      label: 'App Store',
      downloads: null,
      metric: 'First-time downloads (Sales Units)',
      storeUrl: APPLE_URL,
      note: 'Missing ASC_ISSUER_ID, ASC_KEY_ID, ASC_PRIVATE_KEY, and/or ASC_VENDOR_NUMBER',
    }
  }

  const startYear = Number(process.env.ASC_START_YEAR || '2025')
  const thisYear = new Date().getUTCFullYear()
  let total = 0
  let periods = 0
  /** @type {string[]} */
  const errors = []

  for (let y = startYear; y <= thisYear; y++) {
    try {
      const yearly = await downloadAppleSalesReport({
        token,
        vendorNumber,
        frequency: 'YEARLY',
        reportDate: String(y),
      })
      if (yearly) {
        total += sumAppleUnits(yearly, APPLE_ID).units
        periods++
        continue
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err))
    }

    // No yearly report (common for the current year) → sum months.
    for (let m = 1; m <= 12; m++) {
      const reportDate = `${y}-${String(m).padStart(2, '0')}`
      try {
        const monthly = await downloadAppleSalesReport({
          token,
          vendorNumber,
          frequency: 'MONTHLY',
          reportDate,
        })
        if (!monthly) continue
        total += sumAppleUnits(monthly, APPLE_ID).units
        periods++
      } catch (err) {
        // Month not published yet — ignore quietly for current year.
        if (y < thisYear || m < new Date().getUTCMonth() + 1) {
          errors.push(err instanceof Error ? err.message : String(err))
        }
      }
    }
  }

  if (periods === 0) {
    return {
      platform: 'app_store',
      label: 'App Store',
      downloads: null,
      metric: 'First-time downloads (Sales Units)',
      storeUrl: APPLE_URL,
      note: errors[0] || 'No App Store sales reports available yet',
    }
  }

  return {
    platform: 'app_store',
    label: 'App Store',
    downloads: total,
    metric: 'First-time downloads (Sales Units)',
    through: new Date().toISOString(),
    storeUrl: APPLE_URL,
    note:
      total === 0
        ? 'Reports loaded but Units summed to 0 — check ASC_APPLE_ID / ASC_SKU filters'
        : undefined,
  }
}

/** @returns {Promise<DownloadsSnapshot>} */
export async function buildDownloadsSnapshot(source = 'live') {
  const setup = []
  /** @type {StoreDownloads[]} */
  const stores = []

  try {
    stores.push(await fetchGooglePlayDownloads())
  } catch (err) {
    stores.push({
      platform: 'google_play',
      label: 'Google Play',
      downloads: null,
      metric: 'Total user installs',
      storeUrl: PLAY_URL,
      note: err instanceof Error ? err.message : String(err),
    })
  }

  try {
    stores.push(await fetchAppStoreDownloads())
  } catch (err) {
    stores.push({
      platform: 'app_store',
      label: 'App Store',
      downloads: null,
      metric: 'First-time downloads (Sales Units)',
      storeUrl: APPLE_URL,
      note: err instanceof Error ? err.message : String(err),
    })
  }

  const numbers = stores.map((s) => s.downloads).filter((n) => n != null)
  const total = numbers.length ? numbers.reduce((a, b) => a + b, 0) : null

  if (stores.some((s) => s.downloads == null)) {
    setup.push(
      'One or more stores are missing credentials or failed — set Netlify env vars (README → Stats) or run npm run stats:fetch locally.',
    )
  }

  return {
    generatedAt: new Date().toISOString(),
    source: numbers.length ? source : 'unconfigured',
    packageName: PACKAGE_NAME,
    appleId: APPLE_ID,
    total,
    stores,
    setup: setup.length ? setup : undefined,
  }
}
