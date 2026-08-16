#!/usr/bin/env node
/**
 * Merge conflicted public/manifest.json during rebase (union by screen id).
 * Prefer newer lastSuccessAt; always keep WebP imageUrl when either side (or disk) has it.
 *
 *   node scripts/merge-manifest-conflict.mjs
 */
import { execSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const manifestPath = path.join(root, 'public/manifest.json')
const thumbsDir = path.join(root, 'public/screens/thumbs')

function preferScreenEntry(a, b) {
  const aAt = Date.parse(a?.lastSuccessAt || '') || 0
  const bAt = Date.parse(b?.lastSuccessAt || '') || 0
  const winner = bAt >= aAt ? b : a
  const loser = winner === b ? a : b
  const webpUrl =
    (typeof winner?.imageUrl === 'string' && winner.imageUrl.includes('/thumbs/') && winner.imageUrl) ||
    (typeof loser?.imageUrl === 'string' && loser.imageUrl.includes('/thumbs/') && loser.imageUrl) ||
    winner?.imageUrl
  return {
    ...winner,
    imageUrl: webpUrl,
    fullImageUrl: winner?.fullImageUrl || loser?.fullImageUrl || `/screens/${winner.id}.png`,
  }
}

function mergeManifestDocuments(ours, theirs) {
  const byId = new Map()
  for (const s of ours?.screens || []) byId.set(s.id, s)
  for (const s of theirs?.screens || []) {
    const prev = byId.get(s.id)
    byId.set(s.id, prev ? preferScreenEntry(prev, s) : s)
  }
  const base =
    Date.parse(theirs?.generatedAt || '') >= Date.parse(ours?.generatedAt || '') ? theirs : ours
  return {
    ...base,
    screens: [...byId.values()],
    generatedAt: new Date().toISOString(),
  }
}

function pointAtThumbsOnDisk(manifest) {
  let n = 0
  for (const screen of manifest.screens || []) {
    const fullRel = `/screens/${screen.id}.png`
    const thumbRel = `/screens/thumbs/${screen.id}.webp`
    screen.fullImageUrl = fullRel
    if (existsSync(path.join(thumbsDir, `${screen.id}.webp`))) {
      if (screen.imageUrl !== thumbRel) n++
      screen.imageUrl = thumbRel
    }
  }
  return n
}

const ours = JSON.parse(execSync('git show :2:public/manifest.json', { cwd: root, encoding: 'utf8' }))
const theirs = JSON.parse(
  execSync('git show :3:public/manifest.json', { cwd: root, encoding: 'utf8' }),
)
const merged = mergeManifestDocuments(ours, theirs)
const rewritten = pointAtThumbsOnDisk(merged)
writeFileSync(manifestPath, `${JSON.stringify(merged, null, 2)}\n`)
console.log(`merged manifest screens=${merged.screens.length} thumbUrls=${rewritten}`)
