import type { DownloadsSnapshot } from './stats-types'

const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.studdly.app'
const APPLE_URL = 'https://apps.apple.com/app/id6755741754'

function formatCount(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('en-US').format(Math.round(n))
}

function formatWhen(iso: string | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  return d.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC')
}

function navHtml(active: 'ui' | 'stats'): string {
  return `
    <nav class="site-nav" aria-label="Dashboard">
      <a href="/ui"${active === 'ui' ? ' aria-current="page"' : ''}>UI Map</a>
      <a href="/stats"${active === 'stats' ? ' aria-current="page"' : ''}>Stats</a>
    </nav>
  `
}

async function loadSnapshot(): Promise<DownloadsSnapshot> {
  const tried: string[] = []
  for (const url of ['/api/downloads', '/.netlify/functions/downloads', '/stats.json']) {
    tried.push(url)
    try {
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) continue
      const data = (await res.json()) as DownloadsSnapshot
      if (data && Array.isArray(data.stores)) return data
    } catch {
      // try next source
    }
  }
  return {
    generatedAt: new Date().toISOString(),
    source: 'unconfigured',
    packageName: 'com.studdly.app',
    appleId: '6755741754',
    total: null,
    stores: [
      {
        platform: 'google_play',
        label: 'Google Play',
        downloads: null,
        metric: 'Total user installs',
        storeUrl: PLAY_URL,
        note: 'API not configured yet',
      },
      {
        platform: 'app_store',
        label: 'App Store',
        downloads: null,
        metric: 'First-time downloads',
        storeUrl: APPLE_URL,
        note: 'API not configured yet',
      },
    ],
    setup: [
      'Add Play Console + App Store Connect credentials as Netlify env vars (see README → Stats).',
      `Tried: ${tried.join(', ')}`,
    ],
  }
}

function storeCard(store: DownloadsSnapshot['stores'][number]): string {
  const icon =
    store.platform === 'google_play'
      ? '<i class="fa-brands fa-google-play" aria-hidden="true"></i>'
      : '<i class="fa-brands fa-apple" aria-hidden="true"></i>'
  const through = store.through
    ? `<p class="stat-through">Through ${formatWhen(store.through)}</p>`
    : ''
  const note = store.note ? `<p class="stat-note">${escapeHtml(store.note)}</p>` : ''
  return `
    <article class="stat-card" data-platform="${store.platform}">
      <header class="stat-card-head">
        <span class="stat-icon">${icon}</span>
        <div>
          <h2>${escapeHtml(store.label)}</h2>
          <p class="stat-metric">${escapeHtml(store.metric)}</p>
        </div>
      </header>
      <p class="stat-number" data-value="${store.downloads ?? ''}">${formatCount(store.downloads)}</p>
      ${through}
      ${note}
      <a class="stat-store-link" href="${escapeHtml(store.storeUrl)}" target="_blank" rel="noopener noreferrer">
        Open store listing <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
      </a>
    </article>
  `
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export async function createStatsPage(host: HTMLElement): Promise<void> {
  document.documentElement.classList.add('page-stats')
  document.title = 'Studdly · Downloads'

  host.innerHTML = `
    <div class="shell stats-shell">
      <header class="stats-top">
        <div class="brand">
          <h1>Studdly Downloads</h1>
          <p class="stats-sub">Exact install counts from store APIs — not Play Console buckets or App Store Connect estimates.</p>
        </div>
        ${navHtml('stats')}
      </header>
      <main class="stats-main">
        <p class="stats-loading">Loading exact download counts…</p>
      </main>
    </div>
  `

  const main = host.querySelector('.stats-main') as HTMLElement
  const snap = await loadSnapshot()

  const totalBlock =
    snap.total != null
      ? `
        <section class="stat-total">
          <p class="stat-total-label">Combined exact downloads</p>
          <p class="stat-number stat-number-lg">${formatCount(snap.total)}</p>
          <p class="stat-through">Updated ${formatWhen(snap.generatedAt)} · source: ${escapeHtml(snap.source)}</p>
        </section>
      `
      : `
        <section class="stat-total stat-total-empty">
          <p class="stat-total-label">Combined exact downloads</p>
          <p class="stat-number stat-number-lg">—</p>
          <p class="stat-through">Updated ${formatWhen(snap.generatedAt)} · source: ${escapeHtml(snap.source)}</p>
        </section>
      `

  const setup =
    snap.setup && snap.setup.length
      ? `<aside class="stats-setup"><h3>Setup</h3><ul>${snap.setup
          .map((line) => `<li>${escapeHtml(line)}</li>`)
          .join('')}</ul></aside>`
      : ''

  main.innerHTML = `
    ${totalBlock}
    <section class="stat-grid" aria-label="Downloads by store">
      ${snap.stores.map(storeCard).join('')}
    </section>
    ${setup}
    <p class="stats-footnote">
      Google Play: lifetime <em>Total user installs</em> from Console Cloud Storage reports.
      App Store: lifetime <em>first-time downloads</em> (Units) from App Store Connect Sales reports.
      Package <code>${escapeHtml(snap.packageName)}</code> · Apple ID <code>${escapeHtml(snap.appleId)}</code>.
    </p>
  `
}
