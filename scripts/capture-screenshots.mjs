#!/usr/bin/env node
/**
 * Capture Flutter UI preview screenshots into public/screens/.
 *
 * Fail-soft: on error, keep the previous PNG (if any) and mark the frame stale
 * in manifest.json so the map can show an "outdated" badge.
 *
 *   PREVIEW_BASE=http://127.0.0.1:7360/app/ node scripts/capture-screenshots.mjs
 *   DEVICE_SCALE=2 OUT_DIR=public/screens/2x WRITE_MANIFEST=0 node scripts/capture-screenshots.mjs
 */
import { chromium } from 'playwright'
import { access, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
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
const gitSha = (process.env.GITHUB_SHA || 'local').slice(0, 12)
const settleMs = Number(process.env.SETTLE_MS || 2200)

const SCREEN_DEFS = [
  { screenKey: 'onboarding_language', name: 'Onboarding — Language', route: '/onboarding', state: 'default', group: 'Onboarding', tags: ['onboarding'] },
  { screenKey: 'language_picker', name: 'Language Picker', route: '/language-picker', state: 'default', group: 'Onboarding', tags: ['onboarding'] },
  { screenKey: 'onboarding_dialogue_q1', name: 'Onboarding — Q1', route: '/onboarding-dialogue', state: 'q1', group: 'Onboarding', tags: ['onboarding'] },
  { screenKey: 'onboarding_dialogue_q2', name: 'Onboarding — Q2', route: '/onboarding-dialogue', state: 'q2', group: 'Onboarding', tags: ['onboarding'] },
  { screenKey: 'onboarding_dialogue_q3', name: 'Onboarding — Q3', route: '/onboarding-dialogue', state: 'q3', group: 'Onboarding', tags: ['onboarding'] },
  { screenKey: 'onboarding_dialogue_name', name: 'Onboarding — Name', route: '/onboarding-dialogue', state: 'name', group: 'Onboarding', tags: ['onboarding'] },
  { screenKey: 'onboarding_dialogue_video', name: 'Onboarding — Video', route: '/onboarding-dialogue', state: 'video', group: 'Onboarding', tags: ['onboarding'] },
  { screenKey: 'onboarding_dialogue_api_key', name: 'Onboarding — API Key', route: '/onboarding-dialogue', state: 'api_key', group: 'Onboarding', tags: ['onboarding'] },
  { screenKey: 'onboarding_dialogue_final', name: 'Onboarding — Start', route: '/onboarding-dialogue', state: 'final', group: 'Onboarding', tags: ['onboarding'] },
  { screenKey: 'home', name: 'Home — Empty', route: '/home', state: 'empty', group: 'Home', tags: ['home', 'empty'] },
  { screenKey: 'home', name: 'Home — Ready', route: '/home', state: 'ready', group: 'Home', tags: ['home'] },
  { screenKey: 'home', name: 'Home — Analyzing', route: '/home', state: 'analyzing', group: 'Home', tags: ['home'] },
  { screenKey: 'home', name: 'Home — Queued', route: '/home', state: 'queued', group: 'Home', tags: ['home'] },
  { screenKey: 'create_topic', name: 'Create Topic — Empty', route: '/create-topic', state: 'empty', group: 'Create Topic', tags: ['create'] },
  { screenKey: 'create_topic', name: 'Create Topic — With Pages', route: '/create-topic', state: 'with_pages', group: 'Create Topic', tags: ['create'] },
  { screenKey: 'create_topic', name: 'Create Topic — OCR', route: '/create-topic', state: 'ocr', group: 'Create Topic', tags: ['create'] },
  { screenKey: 'topic_path', name: 'Learning Path — Empty', route: '/topic', state: 'empty', group: 'Learning', tags: ['path'] },
  { screenKey: 'topic_path', name: 'Learning Path — Ready', route: '/topic', state: 'ready', group: 'Learning', tags: ['path'] },
  { screenKey: 'topic_path', name: 'Learning Path — Partial', route: '/topic', state: 'partial', group: 'Learning', tags: ['path'] },
  { screenKey: 'read_text', name: 'Read Text', route: '/read', state: 'default', group: 'Learning', tags: ['read'] },
  { screenKey: 'quiz', name: 'Quiz — Unanswered', route: '/quiz', state: 'unanswered', group: 'Quiz', tags: ['quiz'] },
  { screenKey: 'quiz', name: 'Quiz — Correct', route: '/quiz', state: 'correct', group: 'Quiz', tags: ['quiz'] },
  { screenKey: 'quiz', name: 'Quiz — Wrong', route: '/quiz', state: 'wrong', group: 'Quiz', tags: ['quiz'] },
  { screenKey: 'quiz', name: 'Quiz — Completed', route: '/quiz', state: 'completed', group: 'Quiz', tags: ['quiz'] },
  { screenKey: 'settings', name: 'Settings', route: '/settings', state: 'default', group: 'Settings', tags: ['settings'] },
  { screenKey: 'ai_provider_dialog', name: 'AI Provider Picker', route: '/settings', state: 'provider_dialog', group: 'Settings', tags: ['settings', 'dialog'] },
]

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

function jobs() {
  const list = []
  for (const locale of LOCALES) {
    for (const theme of THEMES) {
      for (const def of SCREEN_DEFS) {
        const id = `${def.screenKey}.${def.state}.${theme.id}.${locale.code}`
        const url = new URL(previewBase)
        url.searchParams.set('preview', '1')
        url.searchParams.set('screen', def.screenKey)
        url.searchParams.set('theme', theme.id)
        url.searchParams.set('locale', locale.code)
        url.searchParams.set('state', def.state)
        list.push({ id, url: url.toString(), def })
      }
    }
  }
  return list
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

async function pool(items, limit, worker) {
  const results = []
  let i = 0
  async function run() {
    while (i < items.length) {
      const idx = i++
      results[idx] = await worker(items[idx])
      const done = results.filter(Boolean).length
      if (done % 10 === 0 || done === items.length) {
        console.log(`progress ${done}/${items.length}`)
      }
    }
  }
  await Promise.all(Array.from({ length: limit }, () => run()))
  return results
}

async function main() {
  await mkdir(outDir, { recursive: true })
  const previous = await loadPreviousManifest()
  const all = jobs()
  console.log(
    `Capturing ${all.length} screens from ${previewBase} (scale=${deviceScaleFactor}) → ${outDir}`,
  )
  const browser = await chromium.launch({ headless: true })
  try {
    const results = await pool(all, concurrency, (job) => captureOne(browser, job))
    const byId = new Map(results.map((r) => [r.id, r]))
    const failed = results.filter((r) => !r.ok)
    const keptOld = failed.filter((r) => r.keptOld).length

    if (writeManifest) {
      const screens = []
      for (const job of all) {
        const result = byId.get(job.id)
        const prev = previous.get(job.id)
        const ok = result?.ok === true
        const filePresent = await exists(path.join(root, 'public/screens', `${job.id}.png`))
        const stale = !ok
        screens.push({
          id: job.id,
          name: job.def.name,
          screenKey: job.def.screenKey,
          route: job.def.route,
          theme: job.id.split('.').at(-2),
          locale: job.id.split('.').at(-1),
          state: job.def.state,
          tags: job.def.tags,
          group: job.def.group,
          compareKey: `${job.def.screenKey}|${job.def.state}`,
          imageUrl: `/screens/${job.id}.png`,
          imageUrl2x: `/screens/2x/${job.id}.png`,
          size: { width: device.width, height: device.height },
          stale,
          missing: !filePresent,
          captureError: ok ? undefined : result?.error || 'capture failed',
          lastSuccessSha: ok
            ? gitSha
            : prev?.lastSuccessSha || prev?.gitSha || undefined,
          attemptSha: gitSha,
        })
      }

      const staleCount = screens.filter((s) => s.stale).length
      const manifest = {
        version: 2,
        generatedAt: new Date().toISOString(),
        gitSha,
        appVersion: 'preview-capture',
        flutterPreviewBaseUrl: '/app/',
        captureSummary: {
          total: screens.length,
          failed: staleCount,
          keptOld,
          missing: screens.filter((s) => s.missing).length,
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
            failed: failed.map((f) => ({
              id: f.id,
              keptOld: f.keptOld,
              error: f.error,
            })),
          },
          null,
          2,
        ),
      )
    }

    console.log(`done. failed=${failed.length} keptOld=${keptOld}`)
    for (const f of failed.slice(0, 40)) {
      console.error(`${f.id} keptOld=${f.keptOld} ${f.error}`)
    }
    // Never fail the whole CI pipeline solely due to partial screenshot errors —
    // old frames are retained and marked stale for the map UI.
  } finally {
    await browser.close()
  }
}

await main()
