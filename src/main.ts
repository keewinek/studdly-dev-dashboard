import './style.css'
import { loadManifest } from './catalog'
import { createUiMap } from './ui-map'

async function boot() {
  const app = document.querySelector<HTMLDivElement>('#app')
  if (!app) return

  // Canonical path is /ui — keep / working for Netlify/local.
  if (location.pathname === '/' || location.pathname === '') {
    history.replaceState(null, '', '/ui')
  }

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
