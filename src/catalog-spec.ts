/**
 * Algorithmic UI catalog SPEC.
 * Axes × prune rules → flat (screenKey, state) pairs for the map + Flutter preview.
 */

export type ScreenDef = {
  screenKey: string
  name: string
  route: string
  state: string
  group: string
  tags: string[]
}

type SpecEntry = Omit<ScreenDef, 'state' | 'name'> & {
  /** Human label prefix */
  label: string
  /** Flat state ids to emit (already pruned). */
  states: { state: string; nameSuffix?: string; tags?: string[] }[]
}

/**
 * Hand-pruned products per screen — every layout-changing scroll, overlay,
 * density, and CTA chrome we can seed in Flutter preview.
 */
const SPEC: SpecEntry[] = [
  {
    screenKey: 'onboarding_language',
    label: 'Onboarding — Language',
    route: '/onboarding',
    group: 'Onboarding',
    tags: ['onboarding'],
    states: [{ state: 'default' }, { state: 'other_highlighted', nameSuffix: 'Other' }],
  },
  {
    screenKey: 'language_picker',
    label: 'Language Picker',
    route: '/language-picker',
    group: 'Onboarding',
    tags: ['onboarding'],
    states: [
      { state: 'default' },
      { state: 'no_selection', nameSuffix: 'No Selection', tags: ['empty'] },
      { state: 'search', nameSuffix: 'Search', tags: ['search'] },
      { state: 'search_empty', nameSuffix: 'Search Empty', tags: ['search', 'empty'] },
      { state: 'scrolled_mid', nameSuffix: 'Scrolled', tags: ['scrolled'] },
    ],
  },
  {
    screenKey: 'onboarding_dialogue_q1',
    label: 'Onboarding — Q1',
    route: '/onboarding-dialogue',
    group: 'Onboarding',
    tags: ['onboarding'],
    states: [{ state: 'q1' }, { state: 'option_selected', nameSuffix: 'Option Selected' }],
  },
  {
    screenKey: 'onboarding_dialogue_q2',
    label: 'Onboarding — Q2',
    route: '/onboarding-dialogue',
    group: 'Onboarding',
    tags: ['onboarding'],
    states: [{ state: 'q2' }],
  },
  {
    screenKey: 'onboarding_dialogue_q3',
    label: 'Onboarding — Q3',
    route: '/onboarding-dialogue',
    group: 'Onboarding',
    tags: ['onboarding'],
    states: [{ state: 'q3' }],
  },
  {
    screenKey: 'onboarding_dialogue_name',
    label: 'Onboarding — Name',
    route: '/onboarding-dialogue',
    group: 'Onboarding',
    tags: ['onboarding'],
    states: [
      { state: 'name' },
      { state: 'cta_disabled', nameSuffix: 'CTA Off' },
      { state: 'cta_enabled', nameSuffix: 'CTA On' },
    ],
  },
  {
    screenKey: 'onboarding_dialogue_video',
    label: 'Onboarding — Video',
    route: '/onboarding-dialogue',
    group: 'Onboarding',
    tags: ['onboarding'],
    states: [{ state: 'video' }],
  },
  {
    screenKey: 'onboarding_dialogue_api_key',
    label: 'Onboarding — API Key',
    route: '/onboarding-dialogue',
    group: 'Onboarding',
    tags: ['onboarding'],
    states: [
      { state: 'api_key' },
      { state: 'cta_disabled', nameSuffix: 'Empty' },
      { state: 'testing', nameSuffix: 'Testing' },
      { state: 'error', nameSuffix: 'Invalid' },
      { state: 'visible', nameSuffix: 'Visible' },
    ],
  },
  {
    screenKey: 'onboarding_dialogue_backup',
    label: 'Onboarding — Backup Key',
    route: '/onboarding-dialogue',
    group: 'Onboarding',
    tags: ['onboarding'],
    states: [{ state: 'backup' }],
  },
  {
    screenKey: 'onboarding_dialogue_easy',
    label: 'Onboarding — Easy Dialogue',
    route: '/onboarding-dialogue',
    group: 'Onboarding',
    tags: ['onboarding'],
    states: [{ state: 'easy' }],
  },
  {
    screenKey: 'onboarding_dialogue_final',
    label: 'Onboarding — Start',
    route: '/onboarding-dialogue',
    group: 'Onboarding',
    tags: ['onboarding'],
    states: [{ state: 'final' }],
  },
  {
    screenKey: 'home',
    label: 'Home',
    route: '/home',
    group: 'Home',
    tags: ['home'],
    states: [
      { state: 'empty', nameSuffix: 'Empty', tags: ['empty'] },
      { state: 'ready', nameSuffix: 'Ready' },
      { state: 'ready_scrolled_mid', nameSuffix: 'Ready Scrolled', tags: ['scrolled'] },
      { state: 'ready_scrolled_bottom', nameSuffix: 'Ready Bottom', tags: ['scrolled'] },
      { state: 'empty_ready', nameSuffix: 'Empty Ready', tags: ['empty'] },
      { state: 'partial_progress', nameSuffix: 'Partial Progress' },
      { state: 'analyzing', nameSuffix: 'Analyzing' },
      { state: 'queued', nameSuffix: 'Queued' },
      { state: 'mixed_statuses', nameSuffix: 'Mixed Statuses' },
      { state: 'mixed_scrolled_mid', nameSuffix: 'Mixed Scrolled', tags: ['scrolled'] },
      { state: 'search_no_results', nameSuffix: 'Search Empty', tags: ['search', 'empty'] },
      { state: 'context_menu', nameSuffix: 'Context Menu', tags: ['menu'] },
      { state: 'rename', nameSuffix: 'Rename' },
      { state: 'delete_dialog', nameSuffix: 'Delete Dialog', tags: ['dialog'] },
    ],
  },
  {
    screenKey: 'create_topic',
    label: 'Create Topic',
    route: '/create-topic',
    group: 'Create Topic',
    tags: ['create'],
    states: [
      { state: 'empty', nameSuffix: 'Empty', tags: ['empty'] },
      { state: 'title_only', nameSuffix: 'Title Only' },
      { state: 'with_pages', nameSuffix: 'With Pages' },
      { state: 'pages_one', nameSuffix: 'One Page' },
      { state: 'ocr', nameSuffix: 'OCR Half' },
      { state: 'ocr_start', nameSuffix: 'OCR Start' },
      { state: 'creating', nameSuffix: 'Creating' },
      { state: 'scrolled_pages', nameSuffix: 'Many Pages', tags: ['scrolled'] },
      { state: 'pages_many_scrolled_mid', nameSuffix: 'Pages Scrolled', tags: ['scrolled'] },
      { state: 'advancement_open', nameSuffix: 'Advancement Open' },
      { state: 'permission_dialog', nameSuffix: 'Permission', tags: ['dialog'] },
      { state: 'suggested_title_dialog', nameSuffix: 'Suggested Title', tags: ['dialog'] },
    ],
  },
  {
    screenKey: 'topic_path',
    label: 'Learning Path',
    route: '/topic',
    group: 'Learning',
    tags: ['path'],
    states: [
      { state: 'empty', nameSuffix: 'Empty', tags: ['empty'] },
      { state: 'partial', nameSuffix: 'Partial / Skeleton' },
      { state: 'ready', nameSuffix: 'Ready' },
      { state: 'expanded', nameSuffix: 'Expanded' },
      { state: 'completed_nodes', nameSuffix: 'Completed Nodes' },
      { state: 'completed_nodes_expanded', nameSuffix: 'Completed Expanded' },
      { state: 'analyzing_with_path', nameSuffix: 'Analyzing + Path' },
      { state: 'scrolled', nameSuffix: 'Scrolled Mid', tags: ['scrolled'] },
      { state: 'ready_scrolled_bottom', nameSuffix: 'Scrolled Bottom', tags: ['scrolled'] },
      { state: 'empty_content_dialog', nameSuffix: 'Empty Content Dialog', tags: ['dialog'] },
    ],
  },
  {
    screenKey: 'read_text',
    label: 'Read Text',
    route: '/read',
    group: 'Learning',
    tags: ['read'],
    states: [
      { state: 'quiz_disabled', nameSuffix: 'Quiz Disabled' },
      { state: 'quiz_enabled', nameSuffix: 'Quiz Enabled' },
      { state: 'empty_content', nameSuffix: 'Empty Content', tags: ['empty'] },
      { state: 'reading_aloud', nameSuffix: 'Reading Aloud' },
      { state: 'scrolled', nameSuffix: 'Scrolled Mid', tags: ['scrolled'] },
      { state: 'scrolled_bottom', nameSuffix: 'Scrolled Bottom', tags: ['scrolled'] },
    ],
  },
  {
    screenKey: 'quiz',
    label: 'Quiz',
    route: '/quiz',
    group: 'Quiz',
    tags: ['quiz'],
    states: [
      { state: 'unanswered', nameSuffix: 'Unanswered' },
      { state: 'correct', nameSuffix: 'Correct' },
      { state: 'wrong', nameSuffix: 'Wrong' },
      { state: 'wrong_with_cta', nameSuffix: 'Wrong + CTA' },
      { state: 'completed', nameSuffix: 'Completed' },
      { state: 'mid_progress', nameSuffix: 'Mid Progress' },
      { state: 'mid_progress_wrong_with_cta', nameSuffix: 'Mid Wrong + CTA' },
      { state: 'revision', nameSuffix: 'Revision' },
      { state: 'revision_wrong', nameSuffix: 'Revision Wrong' },
      { state: 'no_questions', nameSuffix: 'No Questions', tags: ['empty'] },
      { state: 'long_options', nameSuffix: 'Long Options' },
      { state: 'long_options_scrolled_mid', nameSuffix: 'Long Options Scrolled', tags: ['scrolled'] },
    ],
  },
  {
    screenKey: 'settings',
    label: 'Settings',
    route: '/settings',
    group: 'Settings',
    tags: ['settings'],
    states: [
      { state: 'default' },
      { state: 'no_api_key', nameSuffix: 'No API Key', tags: ['empty'] },
      { state: 'key_visible', nameSuffix: 'Key Visible' },
      { state: 'testing', nameSuffix: 'Testing Key' },
      { state: 'clear_confirm', nameSuffix: 'Clear Confirm', tags: ['dialog'] },
      { state: 'sound_muted', nameSuffix: 'Sound Muted' },
      { state: 'groq_selected', nameSuffix: 'Groq Selected' },
      { state: 'scrolled', nameSuffix: 'Scrolled Mid', tags: ['scrolled'] },
      { state: 'scrolled_bottom', nameSuffix: 'Scrolled Bottom', tags: ['scrolled'] },
    ],
  },
  {
    screenKey: 'ai_provider_dialog',
    label: 'AI Provider Picker',
    route: '/settings',
    group: 'Settings',
    tags: ['settings', 'dialog'],
    states: [
      { state: 'provider_dialog', nameSuffix: 'Default' },
      { state: 'keys_none', nameSuffix: 'No Keys' },
      { state: 'keys_some', nameSuffix: 'Some Keys' },
      { state: 'keys_some_scrolled_mid', nameSuffix: 'Scrolled', tags: ['scrolled'] },
    ],
  },
]

const MAX_PAIRS = 120

/** Expand SPEC → flat SCREEN_DEFS (capped). */
export function generateScreenDefs(): ScreenDef[] {
  const out: ScreenDef[] = []
  for (const entry of SPEC) {
    for (const s of entry.states) {
      if (out.length >= MAX_PAIRS) return out
      const name = s.nameSuffix ? `${entry.label} — ${s.nameSuffix}` : entry.label
      out.push({
        screenKey: entry.screenKey,
        name,
        route: entry.route,
        state: s.state,
        group: entry.group,
        tags: [...entry.tags, ...(s.tags || [])],
      })
    }
  }
  return out
}

export const GENERATED_SCREEN_COUNT = generateScreenDefs().length
