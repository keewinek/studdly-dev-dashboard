import { buildDownloadsSnapshot } from '../scripts/lib/store-downloads.mjs'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' }
  }

  try {
    const snap = await buildDownloadsSnapshot('live')
    return {
      statusCode: 200,
      headers: {
        ...CORS,
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
      body: JSON.stringify(snap),
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      statusCode: 500,
      headers: {
        ...CORS,
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
      body: JSON.stringify({
        generatedAt: new Date().toISOString(),
        source: 'unconfigured',
        packageName: process.env.PLAY_PACKAGE_NAME || 'com.studdly.app',
        appleId: process.env.ASC_APPLE_ID || '6755741754',
        total: null,
        stores: [],
        setup: [message],
      }),
    }
  }
}
