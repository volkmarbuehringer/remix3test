import { createController } from 'remix/router'

import { assetServer } from '../../assets.ts'
import { db } from '../../db.ts'
import { routes } from '../../routes.ts'
import { Document } from '../../ui/document.tsx'
import { HomePage } from '../../ui/scaffold-home-page.tsx'
import { HomeStyles } from '../../ui/home-styles.tsx'

const HEALTH_CHECK_TIMEOUT_MS = 2_000

async function databaseIsReady(): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      db.exec('SELECT 1'),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Database health check timed out')),
          HEALTH_CHECK_TIMEOUT_MS,
        )
      }),
    ])
    return true
  } catch (error) {
    console.error('[health] database check failed:', error instanceof Error ? error.message : error)
    return false
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export default createController(routes, {
  actions: {
    async assets(context) {
      return (
        (await assetServer.fetch(context.request)) ?? new Response('Not Found', { status: 404 })
      )
    },
    async health() {
      let ready = await databaseIsReady()
      return Response.json(
        { status: ready ? 'ok' : 'unavailable' },
        {
          status: ready ? 200 : 503,
          headers: { 'Cache-Control': 'no-store' },
        },
      )
    },
    home(context) {
      return context.render(
        <Document
          title="newapp – Terminplanung, Kundenmanagement & KI-Assistenz"
          description="newapp vereint Terminplanung, Kundenmanagement und KI-Assistenz in einer Plattform: DSGVO-konform, schnell und ohne Neuladen. Jetzt kostenlos starten."
          head={<HomeStyles />}
        >
          <HomePage />
        </Document>,
      )
    },
  },
})
