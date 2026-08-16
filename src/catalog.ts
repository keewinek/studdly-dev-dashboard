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
  // Onboarding
  { screenKey: 'onboarding_language', name: 'Onboarding — Language', route: '/onboarding', state: 'default', group: 'Onboarding', tags: ['onboarding'] },
  { screenKey: 'language_picker', name: 'Language Picker', route: '/language-picker', state: 'default', group: 'Onboarding', tags: ['onboarding'] },
  { screenKey: 'language_picker', name: 'Language Picker — Search', route: '/language-picker', state: 'search', group: 'Onboarding', tags: ['onboarding', 'search'] },
  { screenKey: 'language_picker', name: 'Language Picker — No Selection', route: '/language-picker', state: 'no_selection', group: 'Onboarding', tags: ['onboarding', 'empty'] },
  { screenKey: 'onboarding_dialogue_q1', name: 'Onboarding — Q1', route: '/onboarding-dialogue', state: 'q1', group: 'Onboarding', tags: ['onboarding'] },
  { screenKey: 'onboarding_dialogue_q2', name: 'Onboarding — Q2', route: '/onboarding-dialogue', state: 'q2', group: 'Onboarding', tags: ['onboarding'] },
  { screenKey: 'onboarding_dialogue_q3', name: 'Onboarding — Q3', route: '/onboarding-dialogue', state: 'q3', group: 'Onboarding', tags: ['onboarding'] },
  { screenKey: 'onboarding_dialogue_name', name: 'Onboarding — Name', route: '/onboarding-dialogue', state: 'name', group: 'Onboarding', tags: ['onboarding'] },
  { screenKey: 'onboarding_dialogue_video', name: 'Onboarding — Video', route: '/onboarding-dialogue', state: 'video', group: 'Onboarding', tags: ['onboarding'] },
  { screenKey: 'onboarding_dialogue_api_key', name: 'Onboarding — API Key', route: '/onboarding-dialogue', state: 'api_key', group: 'Onboarding', tags: ['onboarding'] },
  { screenKey: 'onboarding_dialogue_backup', name: 'Onboarding — Backup Key', route: '/onboarding-dialogue', state: 'backup', group: 'Onboarding', tags: ['onboarding'] },
  { screenKey: 'onboarding_dialogue_easy', name: 'Onboarding — Easy Dialogue', route: '/onboarding-dialogue', state: 'easy', group: 'Onboarding', tags: ['onboarding'] },
  { screenKey: 'onboarding_dialogue_final', name: 'Onboarding — Start', route: '/onboarding-dialogue', state: 'final', group: 'Onboarding', tags: ['onboarding'] },

  // Home
  { screenKey: 'home', name: 'Home — Empty', route: '/home', state: 'empty', group: 'Home', tags: ['home', 'empty'] },
  { screenKey: 'home', name: 'Home — Ready', route: '/home', state: 'ready', group: 'Home', tags: ['home'] },
  { screenKey: 'home', name: 'Home — Empty Ready', route: '/home', state: 'empty_ready', group: 'Home', tags: ['home', 'empty'] },
  { screenKey: 'home', name: 'Home — Partial Progress', route: '/home', state: 'partial_progress', group: 'Home', tags: ['home'] },
  { screenKey: 'home', name: 'Home — Analyzing', route: '/home', state: 'analyzing', group: 'Home', tags: ['home'] },
  { screenKey: 'home', name: 'Home — Queued', route: '/home', state: 'queued', group: 'Home', tags: ['home'] },
  { screenKey: 'home', name: 'Home — Mixed Statuses', route: '/home', state: 'mixed_statuses', group: 'Home', tags: ['home'] },
  { screenKey: 'home', name: 'Home — Scrolled', route: '/home', state: 'scrolled', group: 'Home', tags: ['home', 'scrolled'] },
  { screenKey: 'home', name: 'Home — Search No Results', route: '/home', state: 'search_no_results', group: 'Home', tags: ['home', 'empty', 'search'] },
  { screenKey: 'home', name: 'Home — Context Menu', route: '/home', state: 'context_menu', group: 'Home', tags: ['home', 'menu'] },
  { screenKey: 'home', name: 'Home — Rename', route: '/home', state: 'rename', group: 'Home', tags: ['home'] },
  { screenKey: 'home', name: 'Home — Delete Dialog', route: '/home', state: 'delete_dialog', group: 'Home', tags: ['home', 'dialog'] },

  // Create topic
  { screenKey: 'create_topic', name: 'Create Topic — Empty', route: '/create-topic', state: 'empty', group: 'Create Topic', tags: ['create', 'empty'] },
  { screenKey: 'create_topic', name: 'Create Topic — With Pages', route: '/create-topic', state: 'with_pages', group: 'Create Topic', tags: ['create'] },
  { screenKey: 'create_topic', name: 'Create Topic — OCR', route: '/create-topic', state: 'ocr', group: 'Create Topic', tags: ['create'] },
  { screenKey: 'create_topic', name: 'Create Topic — Creating', route: '/create-topic', state: 'creating', group: 'Create Topic', tags: ['create'] },
  { screenKey: 'create_topic', name: 'Create Topic — Scrolled Pages', route: '/create-topic', state: 'scrolled_pages', group: 'Create Topic', tags: ['create', 'scrolled'] },
  { screenKey: 'create_topic', name: 'Create Topic — Advancement Open', route: '/create-topic', state: 'advancement_open', group: 'Create Topic', tags: ['create'] },
  { screenKey: 'create_topic', name: 'Create Topic — Permission', route: '/create-topic', state: 'permission_dialog', group: 'Create Topic', tags: ['create', 'dialog'] },
  { screenKey: 'create_topic', name: 'Create Topic — Suggested Title', route: '/create-topic', state: 'suggested_title_dialog', group: 'Create Topic', tags: ['create', 'dialog'] },

  // Learning path
  { screenKey: 'topic_path', name: 'Learning Path — Empty', route: '/topic', state: 'empty', group: 'Learning', tags: ['path', 'empty'] },
  { screenKey: 'topic_path', name: 'Learning Path — Ready', route: '/topic', state: 'ready', group: 'Learning', tags: ['path'] },
  { screenKey: 'topic_path', name: 'Learning Path — Partial', route: '/topic', state: 'partial', group: 'Learning', tags: ['path'] },
  { screenKey: 'topic_path', name: 'Learning Path — Expanded', route: '/topic', state: 'expanded', group: 'Learning', tags: ['path'] },
  { screenKey: 'topic_path', name: 'Learning Path — Completed Nodes', route: '/topic', state: 'completed_nodes', group: 'Learning', tags: ['path'] },
  { screenKey: 'topic_path', name: 'Learning Path — Analyzing + Path', route: '/topic', state: 'analyzing_with_path', group: 'Learning', tags: ['path'] },
  { screenKey: 'topic_path', name: 'Learning Path — Scrolled', route: '/topic', state: 'scrolled', group: 'Learning', tags: ['path', 'scrolled'] },
  { screenKey: 'topic_path', name: 'Learning Path — Empty Content Dialog', route: '/topic', state: 'empty_content_dialog', group: 'Learning', tags: ['path', 'dialog'] },

  // Read
  { screenKey: 'read_text', name: 'Read Text — Quiz Disabled', route: '/read', state: 'quiz_disabled', group: 'Learning', tags: ['read'] },
  { screenKey: 'read_text', name: 'Read Text — Quiz Enabled', route: '/read', state: 'quiz_enabled', group: 'Learning', tags: ['read'] },
  { screenKey: 'read_text', name: 'Read Text — Empty Content', route: '/read', state: 'empty_content', group: 'Learning', tags: ['read', 'empty'] },
  { screenKey: 'read_text', name: 'Read Text — Reading Aloud', route: '/read', state: 'reading_aloud', group: 'Learning', tags: ['read'] },
  { screenKey: 'read_text', name: 'Read Text — Scrolled', route: '/read', state: 'scrolled', group: 'Learning', tags: ['read', 'scrolled'] },

  // Quiz
  { screenKey: 'quiz', name: 'Quiz — Unanswered', route: '/quiz', state: 'unanswered', group: 'Quiz', tags: ['quiz'] },
  { screenKey: 'quiz', name: 'Quiz — Correct', route: '/quiz', state: 'correct', group: 'Quiz', tags: ['quiz'] },
  { screenKey: 'quiz', name: 'Quiz — Wrong', route: '/quiz', state: 'wrong', group: 'Quiz', tags: ['quiz'] },
  { screenKey: 'quiz', name: 'Quiz — Wrong + CTA', route: '/quiz', state: 'wrong_with_cta', group: 'Quiz', tags: ['quiz'] },
  { screenKey: 'quiz', name: 'Quiz — Completed', route: '/quiz', state: 'completed', group: 'Quiz', tags: ['quiz'] },
  { screenKey: 'quiz', name: 'Quiz — Mid Progress', route: '/quiz', state: 'mid_progress', group: 'Quiz', tags: ['quiz'] },
  { screenKey: 'quiz', name: 'Quiz — Revision', route: '/quiz', state: 'revision', group: 'Quiz', tags: ['quiz'] },
  { screenKey: 'quiz', name: 'Quiz — No Questions', route: '/quiz', state: 'no_questions', group: 'Quiz', tags: ['quiz', 'empty'] },
  { screenKey: 'quiz', name: 'Quiz — Long Options', route: '/quiz', state: 'long_options', group: 'Quiz', tags: ['quiz', 'scrolled'] },

  // Settings
  { screenKey: 'settings', name: 'Settings', route: '/settings', state: 'default', group: 'Settings', tags: ['settings'] },
  { screenKey: 'settings', name: 'Settings — No API Key', route: '/settings', state: 'no_api_key', group: 'Settings', tags: ['settings', 'empty'] },
  { screenKey: 'settings', name: 'Settings — Key Visible', route: '/settings', state: 'key_visible', group: 'Settings', tags: ['settings'] },
  { screenKey: 'settings', name: 'Settings — Testing Key', route: '/settings', state: 'testing', group: 'Settings', tags: ['settings'] },
  { screenKey: 'settings', name: 'Settings — Clear Confirm', route: '/settings', state: 'clear_confirm', group: 'Settings', tags: ['settings', 'dialog'] },
  { screenKey: 'settings', name: 'Settings — Sound Muted', route: '/settings', state: 'sound_muted', group: 'Settings', tags: ['settings'] },
  { screenKey: 'settings', name: 'Settings — Groq Selected', route: '/settings', state: 'groq_selected', group: 'Settings', tags: ['settings'] },
  { screenKey: 'settings', name: 'Settings — Scrolled', route: '/settings', state: 'scrolled', group: 'Settings', tags: ['settings', 'scrolled'] },
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
