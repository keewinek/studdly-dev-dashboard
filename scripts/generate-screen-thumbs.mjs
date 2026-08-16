#!/usr/bin/env node
/**
 * Build map WebP thumbs from public/screens/*.png → public/screens/thumbs/*.webp
 *
 *   node scripts/generate-screen-thumbs.mjs
 *   THUMB_WIDTH=234 THUMB_QUALITY=72 node scripts/generate-screen-thumbs.mjs
 */
import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { constants as fsConstants } from 'node:fs'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const screensDir = path.resolve(root, process.env.OUT_DIR || 'public/screens')
const thumbsDir = path.join(screensDir, 'thumbs')
const thumbWidth = Number(process.env.THUMB_WIDTH || 234)
const thumbQuality = Number(process.env.THUMB_QUALITY || 72)
const updateManifest = process.env.UPDATE_MANIFEST !== '0'

async function exists(file) {
  try {
    await access(file, fsConstants.F_OK)
    return true
  } catch {
    return false
  }
}

/** Used by capture-screenshots.mjs after each PNG write. */
export async function writeWebpThumb(pngPath, webpPath, opts = {}) {
  const width = Number(opts.width ?? thumbWidth)
  const quality = Number(opts.quality ?? thumbQuality)
  await sharp(pngPath)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality, effort: 4 })
    .toFile(webpPath)
}

async function main() {
  await mkdir(thumbsDir, { recursive: true })
  const names = (await readdir(screensDir)).filter((n) => n.endsWith('.png'))
  console.log(`Generating ${names.length} WebP thumbs @ width=${thumbWidth} q=${thumbQuality}`)

  let ok = 0
  let failed = 0
  const concurrency = Number(process.env.CONCURRENCY || 8)
  let i = 0
  async function worker() {
    while (i < names.length) {
      const name = names[i++]
      const id = name.slice(0, -4)
      const pngPath = path.join(screensDir, name)
      const webpPath = path.join(thumbsDir, `${id}.webp`)
      try {
        await writeWebpThumb(pngPath, webpPath)
        ok++
        if (ok % 100 === 0 || ok === names.length) {
          console.log(`progress ${ok}/${names.length}`)
        }
      } catch (err) {
        failed++
        console.error(`fail ${id}:`, String(err).slice(0, 200))
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()))

  if (updateManifest) {
    const manifestPath = path.join(root, 'public/manifest.json')
    if (await exists(manifestPath)) {
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
      let rewritten = 0
      for (const screen of manifest.screens || []) {
        const thumbRel = `/screens/thumbs/${screen.id}.webp`
        const fullRel = `/screens/${screen.id}.png`
        const thumbOnDisk = await exists(path.join(root, 'public/screens/thumbs', `${screen.id}.webp`))
        screen.fullImageUrl = fullRel
        if (thumbOnDisk) {
          if (screen.imageUrl !== thumbRel) rewritten++
          screen.imageUrl = thumbRel
        } else {
          screen.imageUrl = fullRel
        }
      }
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
      console.log(`manifest: set imageUrl → thumbs for ${rewritten} screens (${manifest.screens?.length || 0} total)`)
    }
  }

  console.log(`done. ok=${ok} failed=${failed}`)
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectRun) {
  await main()
}
