#!/usr/bin/env node
// Run with: node --experimental-strip-types scripts/capture-screenshots.mjs
/**
 * Capture Flutter UI preview screenshots into public/screens/.
 *
 * Fail-soft: on error, keep the previous PNG (if any) and mark the frame stale
 * in manifest.json so the map can show a "Kept old" badge.
 *
 *   PREVIEW_BASE=http://127.0.0.1:7360/app/ node --experimental-strip-types scripts/capture-screenshots.mjs
 *   COMMIT_EACH_PACK=1  — after each locale×theme pack, git commit + push (CI)
 */
import { chromium } from 'playwright'
import { execSync } from 'node:child_process'
import { access, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { constants as fsConstants } from 'node:fs'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const previewBase = (process.env.PREVIEW_BASE || 'https://dev.studdly.app/app/').replace(/\/?$/, '/')
const outDir = path.resolve(root, process.env.OUT_DIR || 'public/screens')
const concurrency = Number(process.env.CONCURRENCY || 3)
const deviceScaleFactor = Number(process.env.DEVICE_SCALE || 1)
const device = { width: 390, height: 844 }
const writeManifest = process.env.WRITE_MANIFEST !== '0'
/** After each locale×theme pack, commit + push so Netlify can update live. */
const commitEachPack = process.env.COMMIT_EACH_PACK === '1'
const gitSha = (process.env.GITHUB_SHA || 'local').slice(0, 12)
const settleMs = Number(process.env.SETTLE_MS || 2200)

function loadScreenDefs() {
  const candidates = [
    path.join(root, 'src/preview_catalog.json'),
    path.join(root, 'public/preview_catalog.json'),
  ]
  for (const file of candidates) {
    try {
      const data = JSON.parse(readFileSync(file, 'utf8'))
      if (Array.isArray(data.screens) && data.screens.length > 0) {
        console.log(`Catalog: ${data.screens.length} screens from ${path.relative(root, file)}`)
        return data.screens
      }
    } catch {
      // try next
    }
  }
  throw new Error(
    'Missing preview_catalog.json — export from Studdly: dart run tool/export_ui_preview_catalog.dart',
  )
}

const SCREEN_DEFS = loadScreenDefs()

const LOCALES = [
  { code: 'en', label: 'English', nativeName: 'English' },
  { code: 'pl', label: 'Polish', nativeName: 'Polski' },
  { code: 'es', label: 'Spanish', nativeName: 'Español' },
  { code: 'de', label: 'German', nativeName: 'Deutsch' },
  { code: 'fr', label: 'French', nativeName: 'Français' },
  { code: 'uk', label: 'Ukrainian', nativeName: 'Українська' },
]

const THEMES = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
]

async function exists(file) {
  try {
    await access(file, fsConstants.F_OK)
    return true
  } catch {
    return false
  }
}

async function loadPreviousManifest() {
  try {
    const raw = await readFile(path.join(root, 'public/manifest.json'), 'utf8')
    const data = JSON.parse(raw)
    const map = new Map()
    for (const screen of data.screens || []) {
      map.set(screen.id, screen)
    }
    return map
  } catch {
    return new Map()
  }
}

function jobs(options = {}) {
  const localeFilter = (options.localeFilter ?? process.env.LOCALE_FILTER ?? '').toLowerCase()
  const themeFilter = (options.themeFilter ?? process.env.THEME_FILTER ?? '').toLowerCase()
  const list = []
  for (const locale of LOCALES) {
    if (localeFilter && locale.code !== localeFilter) continue
    for (const theme of THEMES) {
      if (themeFilter && theme.id !== themeFilter) continue
      for (const def of SCREEN_DEFS) {
        const id = `${def.screenKey}.${def.state}.${theme.id}.${locale.code}`
        const url = new URL(previewBase)
        url.searchParams.set('preview', '1')
        url.searchParams.set('screen', def.screenKey)
        url.searchParams.set('theme', theme.id)
        url.searchParams.set('locale', locale.code)
        url.searchParams.set('state', def.state)
        list.push({
          id,
          url: url.toString(),
          def,
          locale: locale.code,
          theme: theme.id,
        })
      }
    }
  }
  return list
}

/** Packs = one full app matrix slice: locale × theme (e.g. English light). */
function groupIntoPacks(jobList) {
  const packs = []
  const index = new Map()
  for (const job of jobList) {
    const key = `${job.locale}|${job.theme}`
    let pack = index.get(key)
    if (!pack) {
      pack = { locale: job.locale, theme: job.theme, jobs: [] }
      index.set(key, pack)
      packs.push(pack)
    }
    pack.jobs.push(job)
  }
  return packs
}

async function buildScreenEntry(job, result, previous) {
  const ok = result?.ok === true
  const filePresent = await exists(path.join(root, 'public/screens', `${job.id}.png`))
  const prev = previous.get(job.id)
  return {
    id: job.id,
    name: job.def.name,
    screenKey: job.def.screenKey,
    route: job.def.route,
    theme: job.theme,
    locale: job.locale,
    state: job.def.state,
    tags: job.def.tags,
    group: job.def.group,
    compareKey: `${job.def.screenKey}|${job.def.state}`,
    imageUrl: `/screens/${job.id}.png`,
    size: { width: device.width, height: device.height },
    stale: !ok && filePresent,
    missing: !filePresent,
    captureError: ok ? undefined : result?.error || (filePresent ? undefined : 'no screenshot yet'),
    lastSuccessSha: ok
      ? gitSha
      : prev?.lastSuccessSha || undefined,
    lastSuccessAt: ok
      ? new Date().toISOString()
      : prev?.lastSuccessAt || undefined,
    attemptSha: result ? gitSha : prev?.attemptSha,
  }
}

async function writeMergedManifest(catalogJobs, entryById, packFailures) {
  const screens = []
  for (const job of catalogJobs) {
    const entry = entryById.get(job.id)
    if (entry) {
      screens.push(entry)
      continue
    }
    screens.push(await buildScreenEntry(job, null, entryById))
  }
  const missing = screens.filter((s) => s.missing).length
  const stale = screens.filter((s) => s.stale).length
  const manifest = {
    version: 3,
    generatedAt: new Date().toISOString(),
    gitSha,
    appVersion: 'preview-capture',
    flutterPreviewBaseUrl: '/app/',
    captureSummary: {
      total: screens.length,
      failed: stale,
      keptOld: packFailures.filter((f) => f.keptOld).length,
      missing,
    },
    device: {
      name: 'phone',
      width: device.width,
      height: device.height,
      pixelRatio: 1,
    },
    locales: LOCALES,
    themes: THEMES,
    screens,
  }
  await writeFile(path.join(root, 'public/manifest.json'), JSON.stringify(manifest, null, 2))
  await writeFile(
    path.join(root, 'public/capture-report.json'),
    JSON.stringify(
      {
        generatedAt: manifest.generatedAt,
        gitSha,
        failed: packFailures.map((f) => ({
          id: f.id,
          keptOld: f.keptOld,
          error: f.error,
        })),
      },
      null,
      2,
    ),
  )
  return manifest
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function commitAndPushPack(packLabel) {
  const short = String(gitSha).slice(0, 7)
  const message = `chore: UI map pack ${packLabel} from studdly@${short}`
  // Screens + manifest only — Flutter web build is committed once at the end of CI.
  execSync(
    'git add public/screens public/manifest.json public/capture-report.json public/preview_catalog.json src/preview_catalog.json',
    {
      cwd: root,
      stdio: 'inherit',
    },
  )
  const porcelain = execSync('git status --porcelain', { cwd: root, encoding: 'utf8' }).trim()
  if (!porcelain) {
    console.log(`[pack ${packLabel}] nothing new to commit`)
    return
  }
  execSync(`git commit -m ${JSON.stringify(message)}`, { cwd: root, stdio: 'inherit' })

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      execSync('git fetch origin main', { cwd: root, stdio: 'inherit' })
      execSync('git rebase origin/main', { cwd: root, stdio: 'inherit' })
      execSync('git push origin HEAD:main', { cwd: root, stdio: 'inherit' })
      console.log(`[pack ${packLabel}] pushed (attempt ${attempt})`)
      return
    } catch (err) {
      console.warn(
        `[pack ${packLabel}] push/rebase failed attempt ${attempt}:`,
        String(err).slice(0, 200),
      )
      try {
        execSync(
          'git checkout --theirs -- public/screens public/manifest.json public/capture-report.json public/preview_catalog.json src/preview_catalog.json || true',
          { cwd: root, stdio: 'inherit', shell: '/bin/bash' },
        )
        execSync(
          'git add public/screens public/manifest.json public/capture-report.json public/preview_catalog.json src/preview_catalog.json',
          { cwd: root, stdio: 'inherit' },
        )
        execSync('git rebase --continue', {
          cwd: root,
          stdio: 'inherit',
          env: { ...process.env, GIT_EDITOR: 'true' },
        })
      } catch {
        try {
          execSync('git rebase --abort', { cwd: root, stdio: 'inherit' })
        } catch {
          // ignore
        }
      }
      await sleep(10_000)
    }
  }
  throw new Error(`Failed to push pack ${packLabel} after retries`)
}

async function captureOne(browser, job) {
  const finalPath = path.join(outDir, `${job.id}.png`)
  const tempPath = path.join(outDir, `.tmp-${job.id}.${process.pid}.png`)
  const hadPrevious = await exists(finalPath)
  const context = await browser.newContext({
    viewport: device,
    deviceScaleFactor,
  })
  const page = await context.newPage()
  try {
    await page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 90000 })
    await page.waitForFunction(
      () =>
        !!document.querySelector('flt-glass-pane') ||
        document.querySelectorAll('canvas').length > 0,
      { timeout: 60000 },
    )
    await page.waitForTimeout(settleMs)
    if (
      /dialog|scrolled|menu|rename|ocr|creating|advancement|wrong_with_cta|clear_confirm|permission|suggested|expanded/.test(
        job.id,
      )
    ) {
      await page.waitForTimeout(Math.min(settleMs, 1200))
    }
    await page.screenshot({ path: tempPath, type: 'png' })
    await rename(tempPath, finalPath)
    return { ok: true, id: job.id, keptOld: false }
  } catch (error) {
    try {
      await unlink(tempPath)
    } catch {
      // ignore
    }
    return {
      ok: false,
      id: job.id,
      keptOld: hadPrevious,
      error: String(error).slice(0, 500),
    }
  } finally {
    await context.close()
  }
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '?'
  const sec = Math.round(ms / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  const rem = sec % 60
  if (min < 60) return rem ? `${min}m ${rem}s` : `${min}m`
  const hr = Math.floor(min / 60)
  const remMin = min % 60
  return remMin ? `${hr}h ${remMin}m` : `${hr}h`
}

async function pool(items, limit, worker, label = '') {
  const results = []
  let i = 0
  let completed = 0
  const startedAt = Date.now()
  const prefix = label ? `[${label}] ` : ''
  async function run() {
    while (i < items.length) {
      const idx = i++
      results[idx] = await worker(items[idx])
      completed++
      const done = completed
      if (done % 10 === 0 || done === items.length) {
        const elapsed = Date.now() - startedAt
        const rate = done / elapsed
        const remaining = items.length - done
        const etaMs = rate > 0 ? remaining / rate : NaN
        console.log(
          `${prefix}progress ${done}/${items.length} · elapsed ${formatDuration(elapsed)} · ETA ${formatDuration(etaMs)}`,
        )
      }
    }
  }
  await Promise.all(Array.from({ length: limit }, () => run()))
  return results
}

async function main() {
  await mkdir(outDir, { recursive: true })
  const previous = await loadPreviousManifest()
  const catalogJobs = jobs({ localeFilter: '', themeFilter: '' })
  const captureJobs = jobs()
  const packs = groupIntoPacks(captureJobs)

  // Seed entries from previous manifest so partial packs don't wipe other locales.
  const entryById = new Map()
  for (const screen of previous.values()) {
    entryById.set(screen.id, screen)
  }

  console.log(
    `Capturing ${captureJobs.length} screens in ${packs.length} packs (locale×theme) from ${previewBase} → ${outDir}`,
  )
  if (commitEachPack) console.log('COMMIT_EACH_PACK=1 — will push after each pack')

  const browser = await chromium.launch({ headless: true })
  const allFailures = []
  try {
    let packIndex = 0
    for (const pack of packs) {
      packIndex++
      const label = `${pack.theme}.${pack.locale}`
      console.log(
        `\n=== Pack ${packIndex}/${packs.length}: ${label} (${pack.jobs.length} screens) ===`,
      )
      const packResults = await pool(
        pack.jobs,
        concurrency,
        (job) => captureOne(browser, job),
        label,
      )
      for (let i = 0; i < pack.jobs.length; i++) {
        const job = pack.jobs[i]
        const result = packResults[i]
        entryById.set(job.id, await buildScreenEntry(job, result, previous))
        if (result && !result.ok) allFailures.push(result)
      }

      if (writeManifest) {
        await writeMergedManifest(catalogJobs, entryById, allFailures)
      }

      if (commitEachPack) {
        await commitAndPushPack(label)
      }
    }

    const keptOld = allFailures.filter((f) => f.keptOld).length
    console.log(`\ndone. packs=${packs.length} failed=${allFailures.length} keptOld=${keptOld}`)
    for (const f of allFailures.slice(0, 40)) {
      console.error(`${f.id} keptOld=${f.keptOld} ${f.error}`)
    }
    // Never fail the whole CI pipeline solely due to partial screenshot errors —
    // old frames are retained and marked stale for the map UI.
  } finally {
    await browser.close()
  }
}

await main()
