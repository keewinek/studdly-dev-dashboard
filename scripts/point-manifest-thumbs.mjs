#!/usr/bin/env node
/**
 * Point public/manifest.json imageUrls at on-disk WebP thumbs (no re-encode).
 *   node scripts/point-manifest-thumbs.mjs
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const manifestPath = path.join(root, 'public/manifest.json')
const thumbsDir = path.join(root, 'public/screens/thumbs')

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
let rewritten = 0
for (const screen of manifest.screens || []) {
  const fullRel = `/screens/${screen.id}.png`
  const thumbRel = `/screens/thumbs/${screen.id}.webp`
  screen.fullImageUrl = fullRel
  if (existsSync(path.join(thumbsDir, `${screen.id}.webp`))) {
    if (screen.imageUrl !== thumbRel) rewritten++
    screen.imageUrl = thumbRel
  }
}
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`pointed ${rewritten} imageUrls at WebP thumbs (${manifest.screens?.length || 0} total)`)
