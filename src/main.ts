import './style.css'
import { loadManifest } from './catalog'
import { createUiMap } from './ui-map'
import { createStatsPage } from './stats'

function pathOf(): string {
  const p = location.pathname.replace(/\/+$/, '') || '/'
  return p
}

async function boot() {
  const app = document.querySelector<HTMLDivElement>('#app')
  if (!app) return

  const path = pathOf()

  // Canonical paths.
  if (path === '/') {
    history.replaceState(null, '', '/ui')
  }

  const route = pathOf()

  if (route === '/stats') {
    document.documentElement.classList.add('page-stats')
    try {
      await createStatsPage(app)
    } catch (error) {
      console.error(error)
      app.innerHTML = `<div class="shell stats-shell" style="display:grid;place-items:center;padding:24px"><p>Failed to load stats.</p></div>`
    }
    return
  }

  // Default: UI map (/ui and anything else that isn't /stats).
  if (route !== '/ui') {
    history.replaceState(null, '', '/ui')
  }

  document.documentElement.classList.remove('page-stats')
  document.title = 'Studdly · UI Map'
  app.innerHTML = `<div class="shell" style="display:grid;place-items:center"><p style="color:#c8c8c8">Loading UI map…</p></div>`

  try {
    const manifest = await loadManifest()
    createUiMap(app, manifest)
  } catch (error) {
    console.error(error)
    app.innerHTML = `<div class="shell" style="display:grid;place-items:center;padding:24px"><p>Failed to load UI map.</p></div>`
  }
}

void boot()
