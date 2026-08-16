#!/usr/bin/env node
/**
 * Capture Flutter UI preview screenshots into public/screens/.
 *
 *   npm i -D playwright
 *   npx playwright install chromium
 *   PREVIEW_BASE=http://127.0.0.1:7357/ node scripts/capture-screenshots.mjs
 */
import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const previewBase = (process.env.PREVIEW_BASE || 'https://dev.studdly.app/app/').replace(/\/?$/, '/')
const outDir = path.resolve(root, process.env.OUT_DIR || 'public/screens')
const concurrency = Number(process.env.CONCURRENCY || 2)
const deviceScaleFactor = Number(process.env.DEVICE_SCALE || 1)
const device = { width: 390, height: 844 }
const writeManifest = process.env.WRITE_MANIFEST !== '0'

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
    await page.waitForTimeout(2800)
    const file = path.join(outDir, `${job.id}.png`)
    await page.screenshot({ path: file, type: 'png' })
    return { ok: true, id: job.id }
  } catch (error) {
    return { ok: false, id: job.id, error: String(error) }
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
  const all = jobs()
  console.log(
    `Capturing ${all.length} screens from ${previewBase} (scale=${deviceScaleFactor}) → ${outDir}`,
  )
  const browser = await chromium.launch({ headless: true })
  try {
    const results = await pool(all, concurrency, (job) => captureOne(browser, job))
    const failed = results.filter((r) => !r.ok)
    if (writeManifest) {
      const manifest = {
        version: 1,
        generatedAt: new Date().toISOString(),
        gitSha: process.env.GITHUB_SHA || 'local',
        appVersion: 'preview-capture',
        flutterPreviewBaseUrl: '/app/',
        device: {
          name: 'phone',
          width: device.width,
          height: device.height,
          pixelRatio: deviceScaleFactor,
        },
        locales: LOCALES,
        themes: THEMES,
        screens: all.map((job) => ({
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
        })),
      }
      await writeFile(path.join(root, 'public/manifest.json'), JSON.stringify(manifest, null, 2))
    }
    console.log(`done. failed=${failed.length}`)
    for (const f of failed.slice(0, 30)) {
      console.error(f.id, f.error)
    }
    if (failed.length > all.length * 0.25) process.exit(1)
  } finally {
    await browser.close()
  }
}

await main()
