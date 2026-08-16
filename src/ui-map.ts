import type { LocaleId, ScreenFrame, ThemeId, UiManifest } from './types'
import {
  frameImageUrl,
  lodFallback,
  lodForScale,
  previewUrl,
  type ImageLod,
} from './types'

interface PanZoomState {
  x: number
  y: number
  scale: number
}

interface LodFrame {
  img: HTMLImageElement
  frame: ScreenFrame
  lod: ImageLod
}

const MIN_SCALE = 0.15
const MAX_SCALE = 5

export function createUiMap(
  host: HTMLElement,
  manifest: UiManifest,
): { destroy: () => void; resetView: () => void; zoomBy: (factor: number) => void } {
  host.innerHTML = ''
  host.classList.add('shell')

  const topbar = document.createElement('div')
  topbar.className = 'topbar'
  const staleCount = manifest.screens.filter((s) => s.stale && !s.missing).length
  const missingCount = manifest.screens.filter((s) => s.missing).length
  const warnBits = [
    staleCount > 0 ? `${staleCount} outdated` : '',
    missingCount > 0 ? `${missingCount} missing` : '',
  ].filter(Boolean)
  topbar.innerHTML = `
    <div class="brand">
      <h1>Studdly UI Map</h1>
      ${
        warnBits.length
          ? `<p class="status-warn" title="Outdated = capture failed and an older PNG is shown. Missing = no PNG yet.">${warnBits.join(' · ')}</p>`
          : ''
      }
    </div>
  `

  const toolbar = document.createElement('div')
  toolbar.className = 'toolbar'
  toolbar.innerHTML = `
    <button type="button" data-action="zoom-out" aria-label="Zoom out">−</button>
    <span class="meta" data-zoom>100%</span>
    <button type="button" data-action="zoom-in" aria-label="Zoom in">+</button>
    <button type="button" data-action="reset" aria-label="Reset zoom">⟲</button>
  `

  const viewport = document.createElement('div')
  viewport.className = 'viewport'
  viewport.tabIndex = 0

  const world = document.createElement('div')
  world.className = 'world'

  const columns = document.createElement('div')
  columns.className = 'columns'

  const lodFrames: LodFrame[] = []

  for (const locale of manifest.locales) {
    columns.appendChild(
      buildLocaleColumn(manifest, locale.code, locale.nativeName, lodFrames),
    )
  }

  world.appendChild(columns)
  viewport.appendChild(world)
  host.append(topbar, viewport, toolbar)

  const state: PanZoomState = { x: 48, y: 24, scale: 0.55 }
  const zoomLabel = toolbar.querySelector('[data-zoom]') as HTMLElement
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  let currentLod: ImageLod = lodForScale(state.scale, dpr)
  let lodTimer: number | null = null

  const applyLod = (lod: ImageLod) => {
    if (lod === currentLod) return
    currentLod = lod
    for (const entry of lodFrames) {
      if (entry.lod === lod) continue
      const next = frameImageUrl(entry.frame, lod)
      if (entry.img.src.endsWith(next) || entry.img.getAttribute('data-lod-src') === next) {
        entry.lod = lod
        continue
      }
      entry.lod = lod
      entry.img.setAttribute('data-lod-src', next)
      entry.img.setAttribute('data-lod', String(lod))
      // Prefetch then swap to avoid flicker
      const pre = new Image()
      pre.decoding = 'async'
      pre.onload = () => {
        if (entry.lod === lod) {
          entry.img.src = next
        }
      }
      pre.onerror = () => {
        const fb = lodFallback(lod)
        if (fb == null || entry.lod !== lod) return
        const fallbackUrl = frameImageUrl(entry.frame, fb)
        entry.lod = fb
        entry.img.setAttribute('data-lod-src', fallbackUrl)
        entry.img.setAttribute('data-lod', String(fb))
        entry.img.src = fallbackUrl
      }
      pre.src = next
    }
  }

  const scheduleLod = () => {
    const next = lodForScale(state.scale, dpr)
    if (next === currentLod) return
    if (lodTimer != null) window.clearTimeout(lodTimer)
    // Swap hi-res early so crisp pixels are ready as you zoom in.
    lodTimer = window.setTimeout(() => applyLod(next), 40)
  }

  const applyTransform = () => {
    // Pan with translate only. Zoom by resizing layout (--ms), NOT transform:scale().
    // CSS scale() rasterizes the world as a bitmap and upscales it → pixelated text/borders.
    world.style.setProperty('--ms', String(state.scale))
    world.style.transform = `translate(${state.x}px, ${state.y}px)`
    zoomLabel.textContent = `${Math.round(state.scale * 100)}%`
    scheduleLod()
  }

  const zoomAt = (clientX: number, clientY: number, nextScale: number) => {
    const rect = viewport.getBoundingClientRect()
    const px = clientX - rect.left
    const py = clientY - rect.top
    const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale))
    const wx = (px - state.x) / state.scale
    const wy = (py - state.y) / state.scale
    state.scale = clamped
    state.x = px - wx * state.scale
    state.y = py - wy * state.scale
    applyTransform()
  }

  const zoomBy = (factor: number) => {
    const rect = viewport.getBoundingClientRect()
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, state.scale * factor)
  }

  const resetView = () => {
    state.x = 48
    state.y = 24
    state.scale = 0.55
    applyTransform()
  }

  applyTransform()

  let panning = false
  let panStartX = 0
  let panStartY = 0
  let originX = 0
  let originY = 0
  let moved = false

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest('.open-btn')) return
    panning = true
    moved = false
    panStartX = e.clientX
    panStartY = e.clientY
    originX = state.x
    originY = state.y
    viewport.classList.add('panning')
    viewport.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: PointerEvent) => {
    if (!panning) return
    const dx = e.clientX - panStartX
    const dy = e.clientY - panStartY
    if (Math.hypot(dx, dy) > 3) moved = true
    state.x = originX + dx
    state.y = originY + dy
    applyTransform()
  }

  const onPointerUp = () => {
    panning = false
    viewport.classList.remove('panning')
  }

  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08
    zoomAt(e.clientX, e.clientY, state.scale * factor)
  }

  const pointers = new Map<number, PointerEvent>()
  let pinchStartDist = 0
  let pinchStartScale = 1

  const onPointerDownPinch = (e: PointerEvent) => {
    pointers.set(e.pointerId, e)
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()]
      pinchStartDist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
      pinchStartScale = state.scale
    }
  }

  const onPointerMovePinch = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return
    pointers.set(e.pointerId, e)
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()]
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
      if (pinchStartDist > 0) {
        const midX = (a.clientX + b.clientX) / 2
        const midY = (a.clientY + b.clientY) / 2
        zoomAt(midX, midY, pinchStartScale * (dist / pinchStartDist))
      }
    }
  }

  const onPointerUpPinch = (e: PointerEvent) => {
    pointers.delete(e.pointerId)
    if (pointers.size < 2) {
      pinchStartDist = 0
    }
  }

  const blockSelect = (e: Event) => e.preventDefault()
  viewport.addEventListener('selectstart', blockSelect)
  viewport.addEventListener('dragstart', blockSelect)

  viewport.addEventListener('pointerdown', onPointerDown)
  viewport.addEventListener('pointerdown', onPointerDownPinch)
  viewport.addEventListener('pointermove', onPointerMove)
  viewport.addEventListener('pointermove', onPointerMovePinch)
  viewport.addEventListener('pointerup', onPointerUp)
  viewport.addEventListener('pointerup', onPointerUpPinch)
  viewport.addEventListener('pointercancel', onPointerUp)
  viewport.addEventListener('pointercancel', onPointerUpPinch)
  viewport.addEventListener('wheel', onWheel, { passive: false })

  world.addEventListener('click', (e) => {
    if (moved) {
      e.preventDefault()
      e.stopPropagation()
    }
  }, true)

  toolbar.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('button')
    if (!btn) return
    const action = btn.getAttribute('data-action')
    if (action === 'zoom-in') zoomBy(1.15)
    if (action === 'zoom-out') zoomBy(1 / 1.15)
    if (action === 'reset') resetView()
  })

  return {
    destroy: () => {
      if (lodTimer != null) window.clearTimeout(lodTimer)
      host.innerHTML = ''
    },
    resetView,
    zoomBy,
  }
}

function buildLocaleColumn(
  manifest: UiManifest,
  locale: LocaleId,
  nativeName: string,
  lodFrames: LodFrame[],
): HTMLElement {
  const col = document.createElement('section')
  col.className = 'locale-column'
  col.dataset.locale = locale

  const heading = document.createElement('h2')
  heading.className = 'locale-heading'
  heading.textContent = nativeName

  col.append(heading)

  for (const theme of manifest.themes) {
    col.appendChild(buildThemeBlock(manifest, locale, theme.id, theme.label, lodFrames))
  }

  return col
}

function buildThemeBlock(
  manifest: UiManifest,
  locale: LocaleId,
  theme: ThemeId,
  themeLabel: string,
  lodFrames: LodFrame[],
): HTMLElement {
  const block = document.createElement('section')
  block.className = 'theme-block'
  block.dataset.theme = theme

  const frames = manifest.screens.filter((s) => s.locale === locale && s.theme === theme)
  const title = document.createElement('h3')
  title.className = 'theme-title'
  title.textContent = `${themeLabel} theme`

  const meta = document.createElement('p')
  meta.className = 'theme-meta'
  meta.textContent = `${frames.length} screens`

  const groupsWrap = document.createElement('div')
  groupsWrap.className = 'groups'

  const groups = groupBy(frames, (f) => f.group)
  for (const [groupName, groupFrames] of groups) {
    const groupEl = document.createElement('div')
    const label = document.createElement('p')
    label.className = 'group-label'
    label.textContent = groupName

    const grid = document.createElement('div')
    grid.className = 'frames'
    for (const frame of groupFrames) {
      grid.appendChild(buildFrameCard(manifest, frame, lodFrames))
    }

    groupEl.append(label, grid)
    groupsWrap.appendChild(groupEl)
  }

  block.append(title, meta, groupsWrap)
  return block
}

function buildFrameCard(
  manifest: UiManifest,
  frame: ScreenFrame,
  lodFrames: LodFrame[],
): HTMLElement {
  const card = document.createElement('article')
  card.className = 'frame'
  card.dataset.id = frame.id

  const img = document.createElement('img')
  img.alt = ''
  img.draggable = false
  img.loading = 'lazy'
  img.decoding = 'async'
  const initialUrl = frameImageUrl(frame, 1)
  img.src = initialUrl
  img.setAttribute('data-lod-src', initialUrl)

  const fallback = document.createElement('div')
  fallback.className = 'frame-fallback'
  fallback.hidden = true
  fallback.innerHTML = `<strong>${escapeHtml(frame.name)}</strong><span>${escapeHtml(frame.state)} · ${frame.locale} · ${frame.theme}</span>`

  let retries = 0
  img.addEventListener('error', () => {
    const intended = img.getAttribute('data-lod-src') || frame.imageUrl
    if (retries < 2) {
      retries += 1
      const url = new URL(intended, window.location.origin)
      url.searchParams.set('retry', String(retries))
      img.src = url.toString()
      return
    }
    // Fall down the LOD chain: 4× → 2× → 1×
    if (intended.includes('/4x/')) {
      const mid = frame.imageUrl2x || `/screens/2x/${frame.id}.png`
      img.setAttribute('data-lod-src', mid)
      img.setAttribute('data-lod', '2')
      img.src = mid
      retries = 0
      return
    }
    if (intended.includes('/2x/')) {
      img.setAttribute('data-lod-src', frame.imageUrl)
      img.setAttribute('data-lod', '1')
      img.src = frame.imageUrl
      retries = 0
      return
    }
    img.remove()
    fallback.hidden = false
  })

  const overlay = document.createElement('div')
  overlay.className = 'frame-overlay'

  const openBtn = document.createElement('button')
  openBtn.type = 'button'
  openBtn.className = 'open-btn'
  openBtn.textContent = 'Open in new tab'
  openBtn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    const url = previewUrl(manifest.flutterPreviewBaseUrl, frame)
    window.open(url, '_blank', 'noopener,noreferrer')
  })

  overlay.appendChild(openBtn)
  card.append(img, fallback, overlay)

  if (frame.stale || frame.missing) {
    card.classList.add('frame-stale')
    const badge = document.createElement('div')
    badge.className = 'stale-badge'
    badge.title = frame.captureError
      ? `Capture failed on ${frame.attemptSha || 'latest'}: ${frame.captureError}`
      : 'Capture failed on the latest commit'
    badge.textContent = frame.missing ? 'Missing' : 'Outdated'
    const detail = document.createElement('span')
    detail.className = 'stale-detail'
    detail.textContent = frame.missing
      ? 'No screenshot yet'
      : `Old build${frame.lastSuccessSha ? ` · ${frame.lastSuccessSha.slice(0, 7)}` : ''}`
    badge.appendChild(detail)
    card.appendChild(badge)
  }

  lodFrames.push({ img, frame, lod: 1 })
  return card
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const key = keyFn(item)
    const list = map.get(key)
    if (list) list.push(item)
    else map.set(key, [item])
  }
  return map
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}
