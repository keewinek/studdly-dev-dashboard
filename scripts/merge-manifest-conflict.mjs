#!/usr/bin/env node
/**
 * Merge conflicted public/manifest.json during rebase (union by screen id).
 * Prefer newer lastSuccessAt; on ties prefer WebP imageUrl.
 *
 *   node scripts/merge-manifest-conflict.mjs
 */
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const manifestPath = path.join(root, 'public/manifest.json')

function preferScreenEntry(a, b) {
  const aAt = Date.parse(a?.lastSuccessAt || '') || 0
  const bAt = Date.parse(b?.lastSuccessAt || '') || 0
  if (bAt !== aAt) return bAt > aAt ? b : a
  const aWebp = typeof a?.imageUrl === 'string' && a.imageUrl.includes('/thumbs/')
  const bWebp = typeof b?.imageUrl === 'string' && b.imageUrl.includes('/thumbs/')
  if (aWebp !== bWebp) return bWebp ? b : a
  return b
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

const ours = JSON.parse(execSync('git show :2:public/manifest.json', { cwd: root, encoding: 'utf8' }))
const theirs = JSON.parse(
  execSync('git show :3:public/manifest.json', { cwd: root, encoding: 'utf8' }),
)
const merged = mergeManifestDocuments(ours, theirs)
writeFileSync(manifestPath, `${JSON.stringify(merged, null, 2)}\n`)
console.log(`merged manifest screens=${merged.screens.length}`)
