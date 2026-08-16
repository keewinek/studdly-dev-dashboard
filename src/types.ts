/** Shared catalog contract between the dashboard and Flutter web preview. */

export type ThemeId = 'light' | 'dark'
export type LocaleId = 'en' | 'pl' | 'es' | 'de' | 'fr' | 'uk'

export interface DeviceSpec {
  name: string
  width: number
  height: number
  pixelRatio: number
}

export interface ScreenFrame {
  /** Stable id: `{screenKey}.{state}.{theme}.{locale}` */
  id: string
  name: string
  screenKey: string
  route: string
  theme: ThemeId
  locale: LocaleId
  state: string
  tags: string[]
  group: string
  /** Identity across theme/locale for future diffs */
  compareKey: string
  /** 1× phone screenshot (zoomed-out LOD). */
  imageUrl: string
  /** 2× mid zoom. */
  imageUrl2x?: string
  /** 4× crisp zoom-in (~1560×3376 — near-4K on phone aspect). */
  imageUrl4x?: string
  size: { width: number; height: number }
  /** True when this commit's capture failed and we kept an older PNG. */
  stale?: boolean
  /** True when no PNG exists at all. */
  missing?: boolean
  /** Capture error message when stale/missing. */
  captureError?: string
  /** Last git SHA that successfully captured this frame. */
  lastSuccessSha?: string
  /** Git SHA of the capture attempt that produced this manifest entry. */
  attemptSha?: string
}

/**
 * World-zoom → texture LOD.
 * Frame tiles are ~156 CSS-px wide; on retina at 400% zoom we need ~4× phone captures.
 */
export type ImageLod = 1 | 2 | 4

export function lodForScale(scale: number, devicePixelRatio = 1): ImageLod {
  const effective = scale * Math.max(1, devicePixelRatio)
  if (effective < 1.15) return 1
  if (effective < 2.4) return 2
  return 4
}

export function frameImageUrl(frame: ScreenFrame, lod: ImageLod): string {
  if (lod === 4) {
    return frame.imageUrl4x || `/screens/4x/${frame.id}.png`
  }
  if (lod === 2) {
    return frame.imageUrl2x || `/screens/2x/${frame.id}.png`
  }
  return frame.imageUrl
}

/** Fallback chain when a higher LOD asset 404s. */
export function lodFallback(lod: ImageLod): ImageLod | null {
  if (lod === 4) return 2
  if (lod === 2) return 1
  return null
}

export interface CaptureSummary {
  total: number
  failed: number
  keptOld: number
  missing: number
}

export interface UiManifest {
  version: number
  generatedAt: string
  gitSha: string
  appVersion: string
  flutterPreviewBaseUrl: string
  device: DeviceSpec
  locales: { code: LocaleId; label: string; nativeName: string }[]
  themes: { id: ThemeId; label: string }[]
  screens: ScreenFrame[]
  captureSummary?: CaptureSummary
}

export function previewUrl(
  base: string,
  frame: Pick<ScreenFrame, 'screenKey' | 'theme' | 'locale' | 'state'>,
): string {
  const url = new URL(base, window.location.origin)
  url.searchParams.set('preview', '1')
  url.searchParams.set('screen', frame.screenKey)
  url.searchParams.set('theme', frame.theme)
  url.searchParams.set('locale', frame.locale)
  url.searchParams.set('state', frame.state)
  return url.toString()
}
