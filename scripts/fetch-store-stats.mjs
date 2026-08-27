#!/usr/bin/env node
/**
 * Fetch exact Play + App Store download totals → public/stats.json
 *
 * Requires env vars (see README → Stats). Loads .env if present.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildDownloadsSnapshot } from './lib/store-downloads.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = resolve(root, '.env')

function loadEnvFile() {
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] == null) process.env[key] = val
  }
}

loadEnvFile()

const snap = await buildDownloadsSnapshot('static')
const out = resolve(root, 'public/stats.json')
writeFileSync(out, `${JSON.stringify(snap, null, 2)}\n`)
console.log(`Wrote ${out}`)
console.log(
  snap.stores
    .map((s) => `${s.label}: ${s.downloads ?? s.note ?? 'null'}`)
    .join('\n'),
)
console.log(`Total: ${snap.total ?? '—'}`)
