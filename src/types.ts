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
  /** 1× phone screenshot (default / zoomed-out LOD). */
  imageUrl: string
  /** Optional 2× screenshot for zoomed-in LOD. */
  imageUrl2x?: string
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

/** World-zoom → texture LOD. Higher zoom loads sharper assets. */
export type ImageLod = 1 | 2

export function lodForScale(scale: number): ImageLod {
  return scale >= 1 ? 2 : 1
}

export function frameImageUrl(frame: ScreenFrame, lod: ImageLod): string {
  if (lod === 2) {
    return frame.imageUrl2x || `/screens/2x/${frame.id}.png`
  }
  return frame.imageUrl
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
