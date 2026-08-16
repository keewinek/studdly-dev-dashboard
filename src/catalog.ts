import type { LocaleId, ScreenFrame, ThemeId, UiManifest } from './types'

/** Canonical screen catalog — mirrored in Flutter `ui_preview_registry.dart`. */
export const SCREEN_DEFS: {
  screenKey: string
  name: string
  route: string
  state: string
  group: string
  tags: string[]
}[] = [
  { screenKey: 'onboarding_language', name: 'Onboarding — Language', route: '/onboarding', state: 'default', group: 'Onboarding', tags: ['onboarding'] },
  { screenKey: 'language_picker', name: 'Language Picker', route: '/language-picker', state: 'default', group: 'Onboarding', tags: ['onboarding'] },
  { screenKey: 'onboarding_dialogue_q1', name: 'Onboarding — Q1', route: '/onboarding-dialogue', state: 'q1', group: 'Onboarding', tags: ['onboarding'] },
  { screenKey: 'onboarding_dialogue_q2', name: 'Onboarding — Q2', route: '/onboarding-dialogue', state: 'q2', group: 'Onboarding', tags: ['onboarding'] },
  { screenKey: 'onboarding_dialogue_q3', name: 'Onboarding — Q3', route: '/onboarding-dialogue', state: 'q3', group: 'Onboarding', tags: ['onboarding'] },
  { screenKey: 'onboarding_dialogue_name', name: 'Onboarding — Name', route: '/onboarding-dialogue', state: 'name', group: 'Onboarding', tags: ['onboarding'] },
  { screenKey: 'onboarding_dialogue_video', name: 'Onboarding — Video', route: '/onboarding-dialogue', state: 'video', group: 'Onboarding', tags: ['onboarding'] },
  { screenKey: 'onboarding_dialogue_api_key', name: 'Onboarding — API Key', route: '/onboarding-dialogue', state: 'api_key', group: 'Onboarding', tags: ['onboarding'] },
  { screenKey: 'onboarding_dialogue_final', name: 'Onboarding — Start', route: '/onboarding-dialogue', state: 'final', group: 'Onboarding', tags: ['onboarding'] },
  { screenKey: 'home', name: 'Home — Empty', route: '/home', state: 'empty', group: 'Home', tags: ['home', 'empty'] },
  { screenKey: 'home', name: 'Home — Ready', route: '/home', state: 'ready', group: 'Home', tags: ['home'] },
  { screenKey: 'home', name: 'Home — Analyzing', route: '/home', state: 'analyzing', group: 'Home', tags: ['home'] },
  { screenKey: 'home', name: 'Home — Queued', route: '/home', state: 'queued', group: 'Home', tags: ['home'] },
  { screenKey: 'create_topic', name: 'Create Topic — Empty', route: '/create-topic', state: 'empty', group: 'Create Topic', tags: ['create'] },
  { screenKey: 'create_topic', name: 'Create Topic — With Pages', route: '/create-topic', state: 'with_pages', group: 'Create Topic', tags: ['create'] },
  { screenKey: 'create_topic', name: 'Create Topic — OCR', route: '/create-topic', state: 'ocr', group: 'Create Topic', tags: ['create'] },
  { screenKey: 'topic_path', name: 'Learning Path — Empty', route: '/topic', state: 'empty', group: 'Learning', tags: ['path'] },
  { screenKey: 'topic_path', name: 'Learning Path — Ready', route: '/topic', state: 'ready', group: 'Learning', tags: ['path'] },
  { screenKey: 'topic_path', name: 'Learning Path — Partial', route: '/topic', state: 'partial', group: 'Learning', tags: ['path'] },
  { screenKey: 'read_text', name: 'Read Text', route: '/read', state: 'default', group: 'Learning', tags: ['read'] },
  { screenKey: 'quiz', name: 'Quiz — Unanswered', route: '/quiz', state: 'unanswered', group: 'Quiz', tags: ['quiz'] },
  { screenKey: 'quiz', name: 'Quiz — Correct', route: '/quiz', state: 'correct', group: 'Quiz', tags: ['quiz'] },
  { screenKey: 'quiz', name: 'Quiz — Wrong', route: '/quiz', state: 'wrong', group: 'Quiz', tags: ['quiz'] },
  { screenKey: 'quiz', name: 'Quiz — Completed', route: '/quiz', state: 'completed', group: 'Quiz', tags: ['quiz'] },
  { screenKey: 'settings', name: 'Settings', route: '/settings', state: 'default', group: 'Settings', tags: ['settings'] },
  { screenKey: 'ai_provider_dialog', name: 'AI Provider Picker', route: '/settings', state: 'provider_dialog', group: 'Settings', tags: ['settings', 'dialog'] },
]

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
    version: 1,
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
        }))
        return data
      }
    }
  } catch {
    // fall through to generated catalog
  }
  return buildCatalogManifest()
}
