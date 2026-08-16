import type { LocaleId, ScreenFrame, ThemeId, UiManifest } from './types'
import { generateScreenDefs } from './catalog-spec'

/** Canonical screen catalog — generated from axes/prunes in catalog-spec.ts. */
export const SCREEN_DEFS = generateScreenDefs()

export const LOCALES: { code: LocaleId; label: string; nativeName: string }[] = [
  { code: 'en', label: 'English', nativeName: 'English' },
  { code: 'pl', label: 'Polish', nativeName: 'Polski' },
  { code: 'es', label: 'Spanish', nativeName: 'Español' },
  { code: 'de', label: 'German', nativeName: 'Deutsch' },
  { code: 'fr', label: 'French', nativeName: 'Français' },
  { code: 'uk', label: 'Ukrainian', nativeName: 'Українська' },
]

export const THEMES: { id: ThemeId; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
]

const DEVICE = { name: 'phone', width: 390, height: 844, pixelRatio: 1 }

function buildFrame(
  def: (typeof SCREEN_DEFS)[number],
  theme: ThemeId,
  locale: LocaleId,
): ScreenFrame {
  const id = `${def.screenKey}.${def.state}.${theme}.${locale}`
  return {
    id,
    name: def.name,
    screenKey: def.screenKey,
    route: def.route,
    theme,
    locale,
    state: def.state,
    tags: def.tags,
    group: def.group,
    compareKey: `${def.screenKey}|${def.state}`,
    imageUrl: `/screens/${id}.png`,
    imageUrl2x: `/screens/2x/${id}.png`,
    imageUrl4x: `/screens/4x/${id}.png`,
    size: { width: DEVICE.width, height: DEVICE.height },
  }
}

/** Full matrix until CI publishes a real manifest.json. */
export function buildCatalogManifest(): UiManifest {
  const screens: ScreenFrame[] = []
  for (const locale of LOCALES) {
    for (const theme of THEMES) {
      for (const def of SCREEN_DEFS) {
        screens.push(buildFrame(def, theme.id, locale.code))
      }
    }
  }

  return {
    version: 3,
    generatedAt: new Date().toISOString(),
    gitSha: 'local',
    appVersion: 'catalog',
    flutterPreviewBaseUrl: import.meta.env.VITE_FLUTTER_PREVIEW_URL ?? '/app/',
    device: DEVICE,
    locales: LOCALES,
    themes: THEMES,
    screens,
  }
}

export async function loadManifest(): Promise<UiManifest> {
  try {
    const res = await fetch(`/manifest.json?t=${Date.now()}`)
    if (res.ok) {
      const data = (await res.json()) as UiManifest
      if (Array.isArray(data.screens) && data.screens.length > 0) {
        data.screens = data.screens.map((screen) => ({
          ...screen,
          imageUrl2x: screen.imageUrl2x || `/screens/2x/${screen.id}.png`,
          imageUrl4x: screen.imageUrl4x || `/screens/4x/${screen.id}.png`,
        }))
        return data
      }
    }
  } catch {
    // fall through to generated catalog
  }
  return buildCatalogManifest()
}
