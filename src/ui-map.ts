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
  cell: HTMLElement
  img: HTMLImageElement
  fallback: HTMLElement
  frame: ScreenFrame
  activated: boolean
  /** True while a decode is in-flight or queued. */
  loading: boolean
}

const MIN_SCALE = 0.15
const MAX_SCALE = 5
const ZOOM_SETTLE_MS = 180
const STUDDLY_COMMIT_URL = 'https://github.com/keewinek/studdly/commit'

function shortSha(sha: string | undefined): string {
  return sha ? sha.slice(0, 7) : ''
}

/** Prefer per-frame timestamp; fall back to manifest time when SHA matches the latest run. */
function frameSuccessAt(frame: ScreenFrame, manifest: UiManifest): string | undefined {
  if (frame.lastSuccessAt) return frame.lastSuccessAt
  if (frame.lastSuccessSha && frame.lastSuccessSha === manifest.gitSha) {
    return manifest.generatedAt
  }
  return undefined
}

function formatRelativeTime(iso: string, now = Date.now()): string {
  const then = Date.parse(iso)
  if (!Number.isFinite(then)) return 'unknown'
  const deltaSec = Math.round((then - now) / 1000)
  const abs = Math.abs(deltaSec)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  if (abs < 60) return rtf.format(deltaSec, 'second')
  const deltaMin = Math.round(deltaSec / 60)
  if (Math.abs(deltaMin) < 60) return rtf.format(deltaMin, 'minute')
  const deltaHr = Math.round(deltaMin / 60)
  if (Math.abs(deltaHr) < 48) return rtf.format(deltaHr, 'hour')
  const deltaDay = Math.round(deltaHr / 24)
  if (Math.abs(deltaDay) < 30) return rtf.format(deltaDay, 'day')
  const deltaMonth = Math.round(deltaDay / 30)
  if (Math.abs(deltaMonth) < 12) return rtf.format(deltaMonth, 'month')
  return rtf.format(Math.round(deltaDay / 365), 'year')
}

function formatAbsoluteUtc(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  return d.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC')
}

/** Healthy PNG from an older Studdly SHA than the latest completed map run. */
function isBehindLatest(frame: ScreenFrame, manifest: UiManifest): boolean {
  // Mid-run pack publishes rewrite manifest.gitSha while other locales are still
  // on the previous SHA — suppress "Behind" until the full capture finishes.
  if (manifest.captureInProgress) return false
  if (frame.missing || frame.stale || !frame.lastSuccessSha) return false
  return frame.lastSuccessSha !== manifest.gitSha
}

export function createUiMap(
  host: HTMLElement,
  manifest: UiManifest,
): { destroy: () => void; resetView: () => void; zoomBy: (factor: number) => void } {
  host.innerHTML = ''
  host.classList.add('shell')

  const keptOldCount = manifest.screens.filter((s) => s.stale && !s.missing).length
  const missingCount = manifest.screens.filter((s) => s.missing).length
  const behindCount = manifest.screens.filter((s) => isBehindLatest(s, manifest)).length
  const warnBits = [
    manifest.captureInProgress ? 'capture in progress' : '',
    behindCount > 0 ? `${behindCount} behind` : '',
    keptOldCount > 0 ? `${keptOldCount} kept old` : '',
    missingCount > 0 ? `${missingCount} missing` : '',
  ].filter(Boolean)

  const topbar = document.createElement('div')
  topbar.className = 'topbar'
  topbar.innerHTML = `
    <div class="brand">
      <h1>Studdly UI Map</h1>
      ${
        warnBits.length
          ? `<p class="status-warn" title="Capture in progress = mid-run pack publish (Behind badges suppressed). Behind = older successful capture than the latest completed map run. Kept old = capture failed and a previous PNG is shown. Missing = no PNG yet.">${warnBits.join(' · ')}</p>`
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

  const MAX_CONCURRENT_IMAGES = 8
  let inFlightImages = 0
  const imageQueue: Tile[] = []

  const unloadTileImage = (tile: Tile) => {
    if (tile.frame.missing) return
    const qIdx = imageQueue.indexOf(tile)
    if (qIdx >= 0) imageQueue.splice(qIdx, 1)
    const wasLoading = tile.loading
    tile.img.onload = null
    tile.img.onerror = null
    if (tile.img.getAttribute('src')) {
      tile.img.removeAttribute('src')
    }
    tile.img.hidden = true
    tile.fallback.hidden = true
    tile.activated = false
    tile.loading = false
    if (wasLoading) {
      inFlightImages = Math.max(0, inFlightImages - 1)
      pumpImageQueue()
    }
  }

  const pumpImageQueue = () => {
    while (inFlightImages < MAX_CONCURRENT_IMAGES && imageQueue.length > 0) {
      const tile = imageQueue.shift()
      if (!tile || !tile.activated) continue
      inFlightImages++
      tile.loading = true
      const baseUrl = tile.frame.imageUrl
      let attempts = 0

      const finish = () => {
        inFlightImages--
        tile.loading = false
        tile.img.onload = null
        tile.img.onerror = null
        pumpImageQueue()
      }

      const tryLoad = () => {
        if (!tile.activated) {
          finish()
          return
        }
        attempts++
        tile.img.onload = () => finish()
        tile.img.onerror = () => {
          if (!tile.activated) {
            finish()
            return
          }
          if (attempts < 3) {
            window.setTimeout(tryLoad, 350 * attempts)
            return
          }
          showFallback(tile)
          finish()
        }
        const bust = attempts === 1 ? '' : `${baseUrl.includes('?') ? '&' : '?'}r=${attempts}`
        tile.img.src = `${baseUrl}${bust}`
      }

      tile.img.hidden = false
      tile.fallback.hidden = true
      tryLoad()
    }
  }

  const activate = (tile: Tile) => {
    if (tile.activated) return
    tile.activated = true
    if (tile.frame.missing) {
      showFallback(tile)
      return
    }
    imageQueue.push(tile)
    pumpImageQueue()
  }

  const deactivate = (tile: Tile) => {
    if (!tile.activated || tile.frame.missing) return
    unloadTileImage(tile)
  }

  /** Zoom using cheap CSS scale; layout --ms updates after gesture settles. */
  const zoomAt = (
    clientX: number,
    clientY: number,
    nextVisual: number,
    opts?: { settle?: boolean },
  ) => {
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
    if (opts?.settle !== false) scheduleBake()
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
        const id = (entry.target as HTMLElement).dataset.id
        if (!id) continue
        const tile = tilesById.get(id)
        if (!tile) continue
        if (entry.isIntersecting) activate(tile)
        else deactivate(tile)
      }
    },
    // Generous margin keeps pan smooth; unload kicks in once tiles leave the band.
    { root: viewport, rootMargin: '280px', threshold: 0 },
  )
  for (const tile of tilesById.values()) observer.observe(tile.card)

  schedulePaint()

  // Google Maps–style gestures: 1 finger = pan, 2 fingers = pinch-zoom + mid pan.
  type GestureMode = 'none' | 'pan' | 'pinch'
  const activePointers = new Map<number, { x: number; y: number; type: string }>()
  let gestureMode: GestureMode = 'none'
  let panOriginX = 0
  let panOriginY = 0
  let panStartX = 0
  let panStartY = 0
  let pinchStartDist = 0
  let pinchStartVisual = 1
  let lastPinchMidX = 0
  let lastPinchMidY = 0
  let moved = false
  let lastTapAt = 0
  let lastTapX = 0
  let lastTapY = 0

  const CHROME_IDLE_MS = 200
  let chromeTimer: number | null = null
  let lastChromeX = Number.NaN
  let lastChromeY = Number.NaN
  let chromeVisible = false

  const hideChrome = () => {
    if (chromeTimer != null) {
      window.clearTimeout(chromeTimer)
      chromeTimer = null
    }
    if (chromeVisible) {
      chromeVisible = false
      viewport.classList.remove('show-chrome')
    }
  }

  const bumpChrome = () => {
    if (gestureMode !== 'none') {
      hideChrome()
      return
    }
    if (!chromeVisible) {
      chromeVisible = true
      viewport.classList.add('show-chrome')
    }
    if (chromeTimer != null) window.clearTimeout(chromeTimer)
    chromeTimer = window.setTimeout(() => {
      chromeTimer = null
      // Avoid scanning the whole viewport — only check :hover on cheap pseudo.
      if (viewport.matches(':hover') && document.querySelector('.open-btn:hover, .frame-caption:hover')) {
        bumpChrome()
        return
      }
      hideChrome()
    }, CHROME_IDLE_MS)
  }

  const onPointerMoveChrome = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    if (
      Number.isFinite(lastChromeX) &&
      Math.abs(e.clientX - lastChromeX) < 2 &&
      Math.abs(e.clientY - lastChromeY) < 2
    ) {
      return
    }
    lastChromeX = e.clientX
    lastChromeY = e.clientY
    bumpChrome()
  }

  const beginPan = (x: number, y: number) => {
    if (state.transient !== 1) bakeTransient()
    gestureMode = 'pan'
    panStartX = x
    panStartY = y
    panOriginX = state.x
    panOriginY = state.y
    viewport.classList.add('panning')
    hideChrome()
  }

  const beginPinch = () => {
    if (settleTimer != null) {
      window.clearTimeout(settleTimer)
      settleTimer = null
    }
    const pts = [...activePointers.values()]
    if (pts.length < 2) return
    const [a, b] = pts
    gestureMode = 'pinch'
    viewport.classList.remove('panning')
    hideChrome()
    pinchStartDist = Math.hypot(a.x - b.x, a.y - b.y)
    pinchStartVisual = visualScale()
    lastPinchMidX = (a.x + b.x) / 2
    lastPinchMidY = (a.y + b.y) / 2
    moved = true
  }

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest('.open-btn') || target.closest('.frame-caption')) {
      moved = false
      bumpChrome()
      return
    }

    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType })
    try {
      viewport.setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }

    if (activePointers.size === 1) {
      moved = false
      beginPan(e.clientX, e.clientY)
    } else if (activePointers.size === 2) {
      beginPinch()
    }
  }

  const onPointerMove = (e: PointerEvent) => {
    if (!activePointers.has(e.pointerId)) {
      onPointerMoveChrome(e)
      return
    }
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType })

    if (gestureMode === 'pan' && activePointers.size === 1) {
      const p = activePointers.values().next().value!
      const dx = p.x - panStartX
      const dy = p.y - panStartY
      if (Math.hypot(dx, dy) > 3) moved = true
      state.x = panOriginX + dx
      state.y = panOriginY + dy
      schedulePaint()
    } else if (gestureMode === 'pinch' && activePointers.size >= 2) {
      const pts = [...activePointers.values()]
      const a = pts[0]
      const b = pts[1]
      const midX = (a.x + b.x) / 2
      const midY = (a.y + b.y) / 2
      const dist = Math.hypot(a.x - b.x, a.y - b.y)

      // Midpoint drag pans (same as Google Maps while pinching).
      state.x += midX - lastPinchMidX
      state.y += midY - lastPinchMidY
      lastPinchMidX = midX
      lastPinchMidY = midY

      if (pinchStartDist > 0) {
        zoomAt(midX, midY, pinchStartVisual * (dist / pinchStartDist), { settle: false })
      }
      moved = true
    }

    onPointerMoveChrome(e)
  }

  const onPointerUp = (e: PointerEvent) => {
    if (!activePointers.has(e.pointerId)) return
    const released = activePointers.get(e.pointerId)!
    activePointers.delete(e.pointerId)
    try {
      viewport.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }

    if (activePointers.size >= 2) {
      beginPinch()
      return
    }

    if (activePointers.size === 1) {
      if (gestureMode === 'pinch') bakeTransient()
      const remaining = activePointers.values().next().value!
      beginPan(remaining.x, remaining.y)
      return
    }

    // No fingers left.
    const wasPinch = gestureMode === 'pinch'
    const wasTap =
      !moved &&
      !wasPinch &&
      (released.type === 'touch' || released.type === 'pen')
    if (wasPinch) bakeTransient()
    gestureMode = 'none'
    viewport.classList.remove('panning')
    pinchStartDist = 0

    if (wasTap) {
      const now = performance.now()
      const dt = now - lastTapAt
      const dist = Math.hypot(released.x - lastTapX, released.y - lastTapY)
      if (dt < 320 && dist < 28) {
        // Double-tap zoom in (Google Maps–style).
        zoomAt(released.x, released.y, visualScale() * 1.8)
        lastTapAt = 0
      } else {
        lastTapAt = now
        lastTapX = released.x
        lastTapY = released.y
        bumpChrome()
      }
    }

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
    bumpChrome()
  }

  const blockSelect = (e: Event) => e.preventDefault()
  viewport.addEventListener('selectstart', blockSelect)
  viewport.addEventListener('dragstart', blockSelect)
  viewport.addEventListener('pointerdown', onPointerDown)
  viewport.addEventListener('pointermove', onPointerMove)
  viewport.addEventListener('pointerup', onPointerUp)
  viewport.addEventListener('pointercancel', onPointerUp)
  viewport.addEventListener('pointerleave', (e) => {
    // Only hide chrome when the primary mouse leaves; don't break multi-touch.
    if (e.pointerType === 'mouse' && activePointers.size === 0) hideChrome()
  })
  viewport.addEventListener('wheel', onWheel, { passive: false })

  world.addEventListener(
    'click',
    (e) => {
      if (!moved) return
      if ((e.target as HTMLElement).closest('.open-btn')) return
      if ((e.target as HTMLElement).closest('.frame-caption')) return
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
      if (chromeTimer != null) window.clearTimeout(chromeTimer)
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
  const cell = document.createElement('div')
  cell.className = 'frame-cell'

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

  const openPreview = () => {
    window.open(
      previewUrl(manifest.flutterPreviewBaseUrl, frame),
      '_blank',
      'noopener,noreferrer',
    )
  }

  const behind = isBehindLatest(frame, manifest)

  // Defer Open chip + filename caption until first interaction (huge DOM savings).
  let chromeReady = false
  const ensureChrome = () => {
    if (chromeReady) return
    chromeReady = true

    const openBtn = document.createElement('button')
    openBtn.type = 'button'
    openBtn.className = 'open-btn'
    openBtn.title = 'Open live preview in a new tab (or double-click the screenshot)'
    openBtn.innerHTML =
      '<i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i><span>Open</span>'
    openBtn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      openPreview()
    })
    card.appendChild(openBtn)

    const successAt = frameSuccessAt(frame, manifest)
    const sha = shortSha(frame.lastSuccessSha)
    const timeLabel = frame.missing
      ? 'not captured'
      : successAt
        ? formatRelativeTime(successAt)
        : sha
          ? 'older commit'
          : 'unknown'

    const caption = document.createElement('div')
    caption.className = 'frame-caption'
    if (behind) caption.classList.add('frame-caption-behind')
    else if (frame.stale) caption.classList.add('frame-caption-stale')

    const mainBtn = document.createElement('button')
    mainBtn.type = 'button'
    mainBtn.className = 'frame-caption-main'
    const absoluteHint = successAt ? ` · ${formatAbsoluteUtc(successAt)}` : ''
    mainBtn.title = `Open preview · ${frame.id}.png${absoluteHint}`
    mainBtn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      openPreview()
    })

    const timeEl = document.createElement('span')
    timeEl.className = 'frame-caption-time'
    timeEl.textContent = timeLabel

    const nameEl = document.createElement('span')
    nameEl.className = 'frame-caption-name'
    nameEl.textContent = `${frame.id}.png`

    mainBtn.append(timeEl, document.createTextNode(' · '), nameEl)
    caption.appendChild(mainBtn)

    if (sha) {
      const shaLink = document.createElement('a')
      shaLink.className = 'frame-caption-sha'
      shaLink.href = `${STUDDLY_COMMIT_URL}/${frame.lastSuccessSha}`
      shaLink.target = '_blank'
      shaLink.rel = 'noopener noreferrer'
      shaLink.textContent = sha
      shaLink.title = `Capture from ${frame.lastSuccessSha} · Open commit`
      shaLink.addEventListener('click', (e) => e.stopPropagation())
      caption.append(document.createTextNode(' · '), shaLink)
    }

    cell.appendChild(caption)
  }

  cell.addEventListener('pointerenter', ensureChrome, { once: true })
  cell.addEventListener('pointerdown', ensureChrome, { once: true })
  card.addEventListener('dblclick', (e) => {
    if (window.matchMedia('(pointer: coarse)').matches) return
    e.preventDefault()
    e.stopPropagation()
    ensureChrome()
    openPreview()
  })

  if (frame.stale || frame.missing) {
    card.classList.add('frame-stale')
    const badge = document.createElement('div')
    badge.className = 'stale-badge'
    badge.title = frame.captureError
      ? `Capture failed on ${frame.attemptSha || 'latest'}: ${frame.captureError}`
      : frame.missing
        ? 'No screenshot for this state yet'
        : 'Capture failed on the latest commit; showing the last good shot'
    const label = document.createElement('span')
    label.textContent = frame.missing ? 'Missing' : 'Kept old'
    const detail = document.createElement('span')
    detail.className = 'stale-detail'
    detail.textContent = frame.missing
      ? 'No screenshot yet'
      : `Last good${frame.lastSuccessSha ? ` · ${shortSha(frame.lastSuccessSha)}` : ''}`
    badge.append(label, detail)
    card.appendChild(badge)
  } else if (behind) {
    card.classList.add('frame-behind')
    const badge = document.createElement('div')
    badge.className = 'stale-badge behind-badge'
    badge.title =
      'This PNG is from an older Studdly commit than the latest UI map run. Newer shots exist for other screens.'
    const label = document.createElement('span')
    label.textContent = 'Behind'
    const detail = document.createElement('span')
    detail.className = 'stale-detail'
    detail.textContent = `from ${shortSha(frame.lastSuccessSha)}`
    badge.append(label, detail)
    card.appendChild(badge)
  }

  tilesById.set(frame.id, {
    card,
    cell,
    img,
    fallback,
    frame,
    activated: !!frame.missing,
    loading: false,
  })

  cell.appendChild(card)
  return cell
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
