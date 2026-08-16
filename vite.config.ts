import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

/**
 * Vite's SPA fallback serves the dashboard index for `/app/`.
 * Flutter lives in `public/app/` — force that HTML for directory URLs in dev.
 */
function serveFlutterPreview(): Plugin {
  return {
    name: 'serve-flutter-preview',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url ?? '').split('?')[0]
        if (pathname !== '/app' && pathname !== '/app/') {
          next()
          return
        }
        const file = path.join(rootDir, 'public/app/index.html')
        if (!fs.existsSync(file)) {
          next()
          return
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end(fs.readFileSync(file))
      })
    },
  }
}

export default defineConfig({
  plugins: [serveFlutterPreview()],
  build: {
    outDir: 'dist',
  },
  server: {
    port: 5173,
  },
})
