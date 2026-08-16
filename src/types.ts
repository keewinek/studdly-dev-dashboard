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
  imageUrl: string
  size: { width: number; height: number }
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
