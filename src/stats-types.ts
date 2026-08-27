/** Exact store download snapshot shown on /stats. */

export interface StoreDownloads {
  /** Platform key. */
  platform: 'google_play' | 'app_store'
  /** Human label. */
  label: string
  /** Exact lifetime download / first-install count when known. */
  downloads: number | null
  /** Metric name as reported by the store API. */
  metric: string
  /** ISO timestamp of the latest day included in the total. */
  through?: string
  /** Error or setup hint when downloads is null. */
  note?: string
  /** Store listing URL. */
  storeUrl: string
}

export interface DownloadsSnapshot {
  generatedAt: string
  source: 'live' | 'cached' | 'static' | 'unconfigured'
  packageName: string
  appleId: string
  total: number | null
  stores: StoreDownloads[]
  setup?: string[]
}
