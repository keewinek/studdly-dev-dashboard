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
  card: HTMLElement
  img: HTMLImageElement
  fallback: HTMLElement
  frame: ScreenFrame
  lod: ImageLod
  /** True once the tile is near the viewport and may fetch images. */
  activated: boolean
  /** Permanent failure — show fallback, stop requesting. */
  failed: boolean
  /** LODs that 404'd for this frame — never re-request them. */
  failedLods: Set<ImageLod>
}

const MIN_SCALE = 0.15
const MAX_SCALE = 5
/** Extra margin so tiles prefetch slightly before they enter view. */
const OBSERVER_MARGIN = '200px'

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
  let desiredLod: ImageLod = lodForScale(state.scale, dpr)
  let lodTimer: number | null = null
  let visibleTimer: number | null = null

  const isNearViewport = (card: HTMLElement): boolean => {
    const vr = viewport.getBoundingClientRect()
    const cr = card.getBoundingClientRect()
    const pad = 240
    return !(
      cr.right < vr.left - pad ||
      cr.left > vr.right + pad ||
      cr.bottom < vr.top - pad ||
      cr.top > vr.bottom + pad
    )
  }

  const showFallback = (entry: LodFrame) => {
    entry.failed = true
    entry.img.removeAttribute('src')
    entry.img.removeAttribute('srcset')
    entry.img.hidden = true
    entry.fallback.hidden = false
    entry.card.classList.add('frame-stale')
  }

  /** Highest LOD ≤ desired that has not already 404'd for this frame. */
  const resolveLod = (entry: LodFrame, want: ImageLod): ImageLod | null => {
    let lod: ImageLod | null = want
    while (lod != null && entry.failedLods.has(lod)) {
      lod = lodFallback(lod)
    }
    return lod
  }

  const loadEntryAtLod = (entry: LodFrame, want: ImageLod) => {
    if (entry.failed || entry.frame.missing) return
    if (!entry.activated) return

    const lod = resolveLod(entry, want)
    if (lod == null) {
      showFallback(entry)
      return
    }

    const next = frameImageUrl(entry.frame, lod)
    const current = entry.img.getAttribute('data-lod-src') || ''
    if (entry.lod === lod && (entry.img.src.endsWith(next) || current === next)) {
      return
    }

    entry.lod = lod
    entry.img.setAttribute('data-lod-src', next)
    entry.img.setAttribute('data-lod', String(lod))
    entry.img.hidden = false
    entry.fallback.hidden = true

    const pre = new Image()
    pre.decoding = 'async'
    pre.onload = () => {
      if (entry.failed) return
      if (entry.img.getAttribute('data-lod-src') !== next) return
      entry.img.src = next
    }
    pre.onerror = () => {
      if (entry.failed) return
      if (entry.img.getAttribute('data-lod-src') !== next) return
      entry.failedLods.add(lod)
      const fb = lodFallback(lod)
      if (fb != null) {
        loadEntryAtLod(entry, fb)
        return
      }
      showFallback(entry)
    }
    pre.src = next
  }

  const activateEntry = (entry: LodFrame) => {
    if (entry.activated || entry.failed) return
    entry.activated = true
    if (entry.frame.missing) {
      showFallback(entry)
      return
    }
    loadEntryAtLod(entry, desiredLod)
  }

  /** Upgrade/downgrade only tiles that are on-screen (avoids 1000+ parallel fetches). */
  const syncVisibleLod = () => {
    for (const entry of lodFrames) {
      if (entry.failed || entry.frame.missing) continue
      if (!isNearViewport(entry.card)) continue
      if (!entry.activated) {
        activateEntry(entry)
        continue
      }
      const target = resolveLod(entry, desiredLod)
      if (target != null && entry.lod !== target) {
        loadEntryAtLod(entry, desiredLod)
      }
    }
  }

  const scheduleVisibleSync = () => {
    if (visibleTimer != null) window.clearTimeout(visibleTimer)
    visibleTimer = window.setTimeout(() => {
      visibleTimer = null
      syncVisibleLod()
    }, 80)
  }

  const scheduleLod = () => {
    const next = lodForScale(state.scale, dpr)
    if (next === desiredLod) {
      scheduleVisibleSync()
      return
    }
    desiredLod = next
    if (lodTimer != null) window.clearTimeout(lodTimer)
    lodTimer = window.setTimeout(() => {
      lodTimer = null
      syncVisibleLod()
    }, 50)
  }

  const applyTransform = () => {
    // Pan with translate only. Zoom by resizing layout (--ms), NOT transform:scale().
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

  // Activate tiles as they approach the viewport (root = map viewport, not the page).
  const observer = new IntersectionObserver(
    (entries) => {
      for (const obs of entries) {
        if (!obs.isIntersecting) continue
        const id = (obs.target as HTMLElement).dataset.id
        if (!id) continue
        const entry = lodFrames.find((f) => f.frame.id === id)
        if (entry) activateEntry(entry)
      }
    },
    { root: viewport, rootMargin: OBSERVER_MARGIN, threshold: 0 },
  )

  for (const entry of lodFrames) {
    observer.observe(entry.card)
  }

  applyTransform()
  // First paint: activate whatever is already visible.
  requestAnimationFrame(() => syncVisibleLod())

  let panning = false
  let panStartX = 0
  let panStartY = 0
  let originX = 0
  let originY = 0
  let moved = false

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest('.open-btn')) {
      moved = false
      return
    }
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
    scheduleVisibleSync()
    // Allow the suppressed click (after a drag) to settle, then clear the flag
    // so the next genuine click (e.g. Open in new tab) works.
    if (moved) {
      window.setTimeout(() => {
        moved = false
      }, 0)
    }
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

  world.addEventListener(
    'click',
    (e) => {
      if (!moved) return
      const target = e.target as HTMLElement
      // Never swallow Open-in-new-tab — only suppress accidental clicks after a drag.
      if (target.closest('.open-btn')) return
      e.preventDefault()
      e.stopPropagation()
    },
    true,
  )

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
      if (visibleTimer != null) window.clearTimeout(visibleTimer)
      observer.disconnect()
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
  img.decoding = 'async'
  // src is assigned only when the tile activates near the viewport.

  const fallback = document.createElement('div')
  fallback.className = 'frame-fallback'
  fallback.hidden = true
  fallback.innerHTML = `<strong>${escapeHtml(frame.name)}</strong><span>${escapeHtml(frame.state)} · ${frame.locale} · ${frame.theme}</span>`

  if (frame.missing) {
    fallback.hidden = false
    img.hidden = true
  }

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
      : frame.missing
        ? 'No screenshot for this state yet'
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

  lodFrames.push({
    card,
    img,
    fallback,
    frame,
    lod: 1,
    activated: false,
    failed: !!frame.missing,
    failedLods: new Set(),
  })
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
