import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, 'quiz-anim-shots')
mkdirSync(outDir, { recursive: true })

const base = (process.env.PREVIEW_BASE || 'http://127.0.0.1:7361/').replace(/\/?$/, '/')

async function openQuiz(page, state) {
  const url = `${base}?preview=1&screen=quiz&theme=dark&locale=en&state=${state}`
  console.log('goto', url)
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForFunction(
    () =>
      !!document.querySelector('flt-glass-pane') ||
      document.querySelectorAll('canvas').length > 0,
    { timeout: 60000 },
  )
  await page.waitForTimeout(2500)
}

async function shot(page, name) {
  const path = join(outDir, `${name}.png`)
  await page.screenshot({ path, fullPage: true })
  console.log('saved', path)
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })

  await openQuiz(page, 'unanswered')
  await shot(page, '01-unanswered')

  // Click first answer option area (approx under dialogue)
  const box = await page.locator('flt-glass-pane, canvas').first().boundingBox()
  if (box) {
    // Options sit roughly mid-lower; try a few taps on option rows
    const xs = box.x + box.width * 0.5
    for (const frac of [0.48, 0.55, 0.62, 0.7]) {
      await page.mouse.click(xs, box.y + box.height * frac)
      await page.waitForTimeout(200)
    }
  }
  await page.waitForTimeout(800)
  await shot(page, '02-after-taps')

  await openQuiz(page, 'correct')
  await shot(page, '03-correct')

  await openQuiz(page, 'wrong_with_cta')
  await shot(page, '04-wrong')

  // Interactive: unanswered again, find text via accessibility tree
  await openQuiz(page, 'unanswered')
  const texts = await page.evaluate(() => {
    const out = []
    const walk = (node) => {
      if (!node) return
      if (node.name) out.push(node.name)
      for (const c of node.children || []) walk(c)
    }
    // flutter semantics not always in a11y tree on web; fallback body text
    out.push(document.body?.innerText || '')
    return out.slice(0, 40)
  })
  console.log('page texts sample:', JSON.stringify(texts).slice(0, 500))

  await browser.close()
  console.log('done')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
