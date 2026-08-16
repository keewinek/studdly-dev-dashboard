#!/usr/bin/env node
// Run with: node scripts/capture-screenshots.mjs
/**
 * Capture Flutter UI preview screenshots into public/screens/.
 *
 * Fail-soft: on error, keep the previous PNG (if any) and mark the frame stale
 * in manifest.json so the map can show a "Kept old" badge.
 *
 *   PREVIEW_BASE=http://127.0.0.1:7360/app/ node scripts/capture-screenshots.mjs
 *   COMMIT_EACH_PACK=1  — after each locale×theme pack, git commit + push (CI)
 */
import { chromium } from 'playwright'
import { execSync } from 'node:child_process'
import { access, copyFile, mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { constants as fsConstants } from 'node:fs'
import { writeWebpThumb } from './generate-screen-thumbs.mjs'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const previewBase = (process.env.PREVIEW_BASE || 'https://dev.studdly.app/app/').replace(/\/?$/, '/')
const outDir = path.resolve(root, process.env.OUT_DIR || 'public/screens')
const thumbsDir = path.join(outDir, 'thumbs')
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
  const thumbPresent = await exists(path.join(root, 'public/screens/thumbs', `${job.id}.webp`))
  const prev = previous.get(job.id)
  const fullImageUrl = `/screens/${job.id}.png`
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
    imageUrl: thumbPresent ? `/screens/thumbs/${job.id}.webp` : fullImageUrl,
    fullImageUrl,
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

async function normalizeScreenImageUrls(screens) {
  for (const screen of screens) {
    const fullRel = `/screens/${screen.id}.png`
    const thumbRel = `/screens/thumbs/${screen.id}.webp`
    screen.fullImageUrl = fullRel
    const thumbOnDisk = await exists(path.join(root, 'public/screens/thumbs', `${screen.id}.webp`))
    if (thumbOnDisk) {
      screen.imageUrl = thumbRel
    } else if (!screen.imageUrl) {
      screen.imageUrl = fullRel
    }
  }
}

async function writeMergedManifest(catalogJobs, entryById, packFailures, options = {}) {
  const captureInProgress = options.captureInProgress === true
  const screens = []
  for (const job of catalogJobs) {
    const entry = entryById.get(job.id)
    if (entry) {
      screens.push(entry)
      continue
    }
    screens.push(await buildScreenEntry(job, null, entryById))
  }
  await normalizeScreenImageUrls(screens)
  const missing = screens.filter((s) => s.missing).length
  const stale = screens.filter((s) => s.stale).length
  const keptOld = packFailures.filter((f) => f.keptOld).length
  const manifest = {
    version: 3,
    generatedAt: new Date().toISOString(),
    gitSha,
    appVersion: 'preview-capture',
    flutterPreviewBaseUrl: '/app/',
    captureInProgress,
    captureSummary: {
      total: screens.length,
      failed: packFailures.length,
      keptOld,
      missing,
      stale,
    },
    device: {
      name: 'phone',
      width: device.width,
      height: device.height,
      pixelRatio: deviceScaleFactor,
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
        thumbFailures: options.thumbFailures || [],
        thumbFailureCount: (options.thumbFailures || []).length,
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

const PACK_PATHS = [
  'public/screens',
  'public/manifest.json',
  'public/capture-report.json',
  'public/preview_catalog.json',
  'src/preview_catalog.json',
]

function isRebasing() {
  return (
    existsSync(path.join(root, '.git/rebase-merge')) ||
    existsSync(path.join(root, '.git/rebase-apply'))
  )
}

function hasStagedChanges() {
  try {
    execSync('git diff --cached --quiet', { cwd: root })
    return false
  } catch {
    return true
  }
}

function stagePackPaths() {
  execSync(`git add -- ${PACK_PATHS.map((p) => JSON.stringify(p)).join(' ')}`, {
    cwd: root,
    stdio: 'inherit',
    shell: '/bin/bash',
  })
  // Never publish in-progress screenshot temps (if any land under public/screens).
  try {
    execSync('git reset HEAD -- public/screens/.tmp-*', {
      cwd: root,
      stdio: 'pipe',
      shell: '/bin/bash',
    })
  } catch {
    // no temps staged
  }
}

function ensurePackCommit(message) {
  stagePackPaths()
  if (!hasStagedChanges()) return false
  execSync(`git commit -m ${JSON.stringify(message)}`, { cwd: root, stdio: 'inherit' })
  return true
}

function resolveConflictedManifest() {
  try {
    execSync('node scripts/merge-manifest-conflict.mjs', {
      cwd: root,
      stdio: 'inherit',
    })
    return true
  } catch {
    return false
  }
}

function resolveRebaseConflicts() {
  const nonManifest = PACK_PATHS.filter((p) => p !== 'public/manifest.json')
  execSync(`git checkout --theirs -- ${nonManifest.map((p) => JSON.stringify(p)).join(' ')}`, {
    cwd: root,
    stdio: 'inherit',
    shell: '/bin/bash',
  })
  if (!resolveConflictedManifest()) {
    execSync('git checkout --theirs -- public/manifest.json', {
      cwd: root,
      stdio: 'inherit',
    })
  }
  execSync(`git add -- ${PACK_PATHS.map((p) => JSON.stringify(p)).join(' ')}`, {
    cwd: root,
    stdio: 'inherit',
    shell: '/bin/bash',
  })
  const unmerged = execSync('git diff --name-only --diff-filter=U', {
    cwd: root,
    encoding: 'utf8',
  }).trim()
  if (unmerged) {
    throw new Error(`Unresolved rebase conflicts:\n${unmerged}`)
  }
  execSync('git rebase --continue', {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, GIT_EDITOR: 'true' },
  })
}

async function commitAndPushPack(packLabel) {
  const short = String(gitSha).slice(0, 7)
  const message = `chore: UI map pack ${packLabel} from studdly@${short}`
  // Screens + manifest only — Flutter web build is committed before packs in CI.
  if (!ensurePackCommit(message)) {
    console.log(`[pack ${packLabel}] nothing new to commit`)
    return
  }

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      execSync('git fetch origin main', { cwd: root, stdio: 'inherit' })
      try {
        execSync('git rebase origin/main', { cwd: root, stdio: 'inherit' })
      } catch (rebaseErr) {
        if (!isRebasing()) throw rebaseErr
        try {
          resolveRebaseConflicts()
        } catch (resolveErr) {
          try {
            execSync('git rebase --abort', { cwd: root, stdio: 'inherit' })
          } catch {
            // ignore
          }
          // Abort drops the pack commit — recreate it before retrying.
          ensurePackCommit(message)
          throw resolveErr
        }
      }
      execSync('git push origin HEAD:main', { cwd: root, stdio: 'inherit' })
      console.log(`[pack ${packLabel}] pushed (attempt ${attempt})`)
      return
    } catch (err) {
      console.warn(
        `[pack ${packLabel}] push/rebase failed attempt ${attempt}:`,
        String(err).slice(0, 200),
      )
      if (isRebasing()) {
        try {
          execSync('git rebase --abort', { cwd: root, stdio: 'inherit' })
        } catch {
          // ignore
        }
        ensurePackCommit(message)
      }
      await sleep(10_000)
    }
  }
  throw new Error(`Failed to push pack ${packLabel} after retries`)
}

async function captureOne(browser, job) {
  const finalPath = path.join(outDir, `${job.id}.png`)
  const tempPath = path.join(tmpdir(), `studdly-ui-${job.id}.${process.pid}.png`)
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
    await copyFile(tempPath, finalPath)
    await unlink(tempPath).catch(() => {})
    await mkdir(thumbsDir, { recursive: true })
    let thumbOk = false
    try {
      await writeWebpThumb(finalPath, path.join(thumbsDir, `${job.id}.webp`))
      thumbOk = true
    } catch (thumbErr) {
      console.warn(`thumb ${job.id}:`, String(thumbErr).slice(0, 180))
    }
    return { ok: true, id: job.id, keptOld: false, thumbOk }
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
  const thumbFailures = []
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
        if (result?.ok && result.thumbOk === false) thumbFailures.push(job.id)
      }

      if (writeManifest) {
        await writeMergedManifest(catalogJobs, entryById, allFailures, {
          captureInProgress: packIndex < packs.length,
          thumbFailures,
        })
      }

      if (commitEachPack) {
        await commitAndPushPack(label)
      }
    }

    const keptOld = allFailures.filter((f) => f.keptOld).length
    console.log(
      `\ndone. packs=${packs.length} failed=${allFailures.length} keptOld=${keptOld} thumbFail=${thumbFailures.length}`,
    )
    for (const f of allFailures.slice(0, 40)) {
      console.error(`${f.id} keptOld=${f.keptOld} ${f.error}`)
    }
    if (thumbFailures.length) {
      console.warn(`thumb failures (${thumbFailures.length}): ${thumbFailures.slice(0, 20).join(', ')}`)
    }
    // Fail CI only when every frame in this run failed (nothing useful captured).
    if (captureJobs.length > 0 && allFailures.length === captureJobs.length) {
      throw new Error(`All ${captureJobs.length} screenshot captures failed`)
    }
  } finally {
    await browser.close()
  }
}

await main()
