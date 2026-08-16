import type { LocaleId, ScreenFrame, ThemeId, UiManifest } from './types'
import { previewUrl } from './types'

interface PanZoom {
  /** Pan offset in CSS px (GPU translate). */
  x: number
  y: number
  /** Committed layout zoom — drives --ms (expensive to change). */
  layout: number
  /** Transient CSS scale during wheel/pinch — cheap; baked into layout on settle. */
  transient: number
}

interface Tile {
  card: HTMLElement
  img: HTMLImageElement
  fallback: HTMLElement
  frame: ScreenFrame
  activated: boolean
}

const MIN_SCALE = 0.15
const MAX_SCALE = 5
const ZOOM_SETTLE_MS = 140

export function createUiMap(
  host: HTMLElement,
  manifest: UiManifest,
): { destroy: () => void; resetView: () => void; zoomBy: (factor: number) => void } {
  host.innerHTML = ''
  host.classList.add('shell')

  const staleCount = manifest.screens.filter((s) => s.stale && !s.missing).length
  const missingCount = manifest.screens.filter((s) => s.missing).length
  const warnBits = [
    staleCount > 0 ? `${staleCount} outdated` : '',
    missingCount > 0 ? `${missingCount} missing` : '',
  ].filter(Boolean)

  const topbar = document.createElement('div')
  topbar.className = 'topbar'
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

  const tilesById = new Map<string, Tile>()
  // Index screens once — avoid O(n) filter per theme block.
  const byLocaleTheme = new Map<string, ScreenFrame[]>()
  for (const screen of manifest.screens) {
    const key = `${screen.locale}|${screen.theme}`
    const list = byLocaleTheme.get(key)
    if (list) list.push(screen)
    else byLocaleTheme.set(key, [screen])
  }

  for (const locale of manifest.locales) {
    columns.appendChild(
      buildLocaleColumn(manifest, locale.code, locale.nativeName, byLocaleTheme, tilesById),
    )
  }

  world.appendChild(columns)
  viewport.appendChild(world)
  host.append(topbar, viewport, toolbar)

  const state: PanZoom = { x: 48, y: 24, layout: 0.55, transient: 1 }
  const zoomLabel = toolbar.querySelector('[data-zoom]') as HTMLElement

  let paintRaf = 0
  let settleTimer: number | null = null
  let lastLayoutWritten = -1

  const visualScale = () => state.layout * state.transient

  const paintNow = () => {
    paintRaf = 0
    const t = state.transient
    world.style.transform =
      t === 1
        ? `translate(${state.x}px, ${state.y}px)`
        : `translate(${state.x}px, ${state.y}px) scale(${t})`
    if (state.layout !== lastLayoutWritten) {
      lastLayoutWritten = state.layout
      world.style.setProperty('--ms', String(state.layout))
    }
    zoomLabel.textContent = `${Math.round(visualScale() * 100)}%`
  }

  const schedulePaint = () => {
    if (paintRaf) return
    paintRaf = requestAnimationFrame(paintNow)
  }

  /** Fold transient CSS scale into layout --ms (crisp settle). Translate stays put at origin 0,0. */
  const bakeTransient = () => {
    if (state.transient === 1) return
    state.layout = Math.min(MAX_SCALE, Math.max(MIN_SCALE, state.layout * state.transient))
    state.transient = 1
    schedulePaint()
  }

  const scheduleBake = () => {
    if (settleTimer != null) window.clearTimeout(settleTimer)
    settleTimer = window.setTimeout(() => {
      settleTimer = null
      bakeTransient()
    }, ZOOM_SETTLE_MS)
  }

  const showFallback = (tile: Tile) => {
    tile.img.removeAttribute('src')
    tile.img.hidden = true
    tile.fallback.hidden = false
    tile.card.classList.add('frame-stale')
  }

  const activate = (tile: Tile) => {
    if (tile.activated) return
    tile.activated = true
    if (tile.frame.missing) {
      showFallback(tile)
      return
    }
    tile.img.hidden = false
    tile.fallback.hidden = true
    tile.img.onerror = () => showFallback(tile)
    tile.img.src = tile.frame.imageUrl
  }

  /** Zoom using cheap CSS scale; layout --ms updates after gesture settles. */
  const zoomAt = (clientX: number, clientY: number, nextVisual: number) => {
    const rect = viewport.getBoundingClientRect()
    const px = clientX - rect.left
    const py = clientY - rect.top
    const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextVisual))
    const t = state.transient
    const wx = (px - state.x) / t
    const wy = (py - state.y) / t
    const nextT = clamped / state.layout
    state.transient = nextT
    state.x = px - wx * nextT
    state.y = py - wy * nextT
    schedulePaint()
    scheduleBake()
  }

  const zoomBy = (factor: number) => {
    const rect = viewport.getBoundingClientRect()
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, visualScale() * factor)
  }

  const resetView = () => {
    if (settleTimer != null) {
      window.clearTimeout(settleTimer)
      settleTimer = null
    }
    state.x = 48
    state.y = 24
    state.layout = 0.55
    state.transient = 1
    schedulePaint()
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const id = (entry.target as HTMLElement).dataset.id
        if (!id) continue
        const tile = tilesById.get(id)
        if (tile) activate(tile)
      }
    },
    { root: viewport, rootMargin: '240px', threshold: 0 },
  )
  for (const tile of tilesById.values()) observer.observe(tile.card)

  schedulePaint()

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
    // Finish any soft zoom before pan so hit-testing stays sane.
    if (state.transient !== 1) bakeTransient()
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
    schedulePaint()
  }

  const onPointerUp = () => {
    panning = false
    viewport.classList.remove('panning')
    if (moved) {
      window.setTimeout(() => {
        moved = false
      }, 0)
    }
  }

  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08
    zoomAt(e.clientX, e.clientY, visualScale() * factor)
  }

  const pointers = new Map<number, PointerEvent>()
  let pinchStartDist = 0
  let pinchStartVisual = 1

  const onPointerDownPinch = (e: PointerEvent) => {
    pointers.set(e.pointerId, e)
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()]
      pinchStartDist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
      pinchStartVisual = visualScale()
    }
  }

  const onPointerMovePinch = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return
    pointers.set(e.pointerId, e)
    if (pointers.size === 2 && pinchStartDist > 0) {
      const [a, b] = [...pointers.values()]
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
      const midX = (a.clientX + b.clientX) / 2
      const midY = (a.clientY + b.clientY) / 2
      zoomAt(midX, midY, pinchStartVisual * (dist / pinchStartDist))
    }
  }

  const onPointerUpPinch = (e: PointerEvent) => {
    pointers.delete(e.pointerId)
    if (pointers.size < 2) {
      pinchStartDist = 0
      bakeTransient()
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
      if ((e.target as HTMLElement).closest('.open-btn')) return
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
      if (paintRaf) cancelAnimationFrame(paintRaf)
      if (settleTimer != null) window.clearTimeout(settleTimer)
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
  byLocaleTheme: Map<string, ScreenFrame[]>,
  tilesById: Map<string, Tile>,
): HTMLElement {
  const col = document.createElement('section')
  col.className = 'locale-column'
  col.dataset.locale = locale

  const heading = document.createElement('h2')
  heading.className = 'locale-heading'
  heading.textContent = nativeName
  col.append(heading)

  for (const theme of manifest.themes) {
    col.appendChild(
      buildThemeBlock(manifest, locale, theme.id, theme.label, byLocaleTheme, tilesById),
    )
  }
  return col
}

function buildThemeBlock(
  manifest: UiManifest,
  locale: LocaleId,
  theme: ThemeId,
  themeLabel: string,
  byLocaleTheme: Map<string, ScreenFrame[]>,
  tilesById: Map<string, Tile>,
): HTMLElement {
  const block = document.createElement('section')
  block.className = 'theme-block'
  block.dataset.theme = theme

  const frames = byLocaleTheme.get(`${locale}|${theme}`) ?? []
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
      grid.appendChild(buildFrameCard(manifest, frame, tilesById))
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
  tilesById: Map<string, Tile>,
): HTMLElement {
  const card = document.createElement('article')
  card.className = 'frame'
  card.dataset.id = frame.id

  const img = document.createElement('img')
  img.alt = ''
  img.draggable = false
  img.decoding = 'async'

  const fallback = document.createElement('div')
  fallback.className = 'frame-fallback'
  fallback.hidden = true
  // Text only — avoid expensive repeating gradients until shown.
  fallback.textContent = ''
  const strong = document.createElement('strong')
  strong.textContent = frame.name
  const span = document.createElement('span')
  span.textContent = `${frame.state} · ${frame.locale} · ${frame.theme}`
  fallback.append(strong, span)

  if (frame.missing) {
    fallback.hidden = false
    img.hidden = true
  }

  card.append(img, fallback)

  // Build Open button on first hover — saves ~1080 overlay nodes at rest.
  let overlayReady = false
  const ensureOverlay = () => {
    if (overlayReady) return
    overlayReady = true
    const overlay = document.createElement('div')
    overlay.className = 'frame-overlay'
    const openBtn = document.createElement('button')
    openBtn.type = 'button'
    openBtn.className = 'open-btn'
    openBtn.textContent = 'Open in new tab'
    openBtn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      window.open(
        previewUrl(manifest.flutterPreviewBaseUrl, frame),
        '_blank',
        'noopener,noreferrer',
      )
    })
    overlay.appendChild(openBtn)
    card.appendChild(overlay)
  }
  card.addEventListener('pointerenter', ensureOverlay, { once: true })

  if (frame.stale || frame.missing) {
    card.classList.add('frame-stale')
    const badge = document.createElement('div')
    badge.className = 'stale-badge'
    badge.title = frame.captureError
      ? `Capture failed on ${frame.attemptSha || 'latest'}: ${frame.captureError}`
      : frame.missing
        ? 'No screenshot for this state yet'
        : 'Capture failed on the latest commit'
    const label = document.createElement('span')
    label.textContent = frame.missing ? 'Missing' : 'Outdated'
    const detail = document.createElement('span')
    detail.className = 'stale-detail'
    detail.textContent = frame.missing
      ? 'No screenshot yet'
      : `Old build${frame.lastSuccessSha ? ` · ${frame.lastSuccessSha.slice(0, 7)}` : ''}`
    badge.append(label, detail)
    card.appendChild(badge)
  }

  tilesById.set(frame.id, {
    card,
    img,
    fallback,
    frame,
    activated: !!frame.missing,
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
