import { after, before, describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../test-router.ts'
import { db, initializeAppDatabase } from '../db.ts'
import { routes } from '../routes.ts'
import { pool } from '../../test/pool.ts'
import { listResources } from '../data/resources.ts'
import { createAuthCookieWithCsrfForUser } from '../../test/utils.ts'
import { TOAST_EVENT } from './toast.ts'

// ---------------------------------------------------------------------------
// Toast survival across an appointment-content frame swap.
//
// The shell ToastHost is mounted once in `Document` and portals into
// `#app-overlay-root`, so a frame swap must not remove either the host or its
// toast. Counting document loads is how the test distinguishes the same-
// document frame swap from a full page reload that would reset the probe.
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000

declare global {
  interface Window {
    __toastSurvivalProbe?: string
  }
}

function currentMondayUtc(): number {
  let now = new Date()
  let dayOfWeek = now.getUTCDay() || 7
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dayOfWeek + 1)
}

describe('toast frame survival', () => {
  let resourceId: number
  let insertedDays: number[] = []

  before(async () => {
    await initializeAppDatabase()
    let resources = await listResources(db)
    assert.ok(resources.length > 0, 'a seeded resource is required')
    resourceId = resources[0]!.id
  })

  after(async () => {
    if (insertedDays.length === 0) return
    await pool.query(
      'DELETE FROM appointoffering WHERE resource_id = $1 AND day = ANY($2::bigint[])',
      [resourceId, insertedDays],
    )
    insertedDays = []
  })

  /** Ensure the current and next two ISO weeks have bookable days. */
  async function seedThreeWeeks(): Promise<void> {
    let start = currentMondayUtc()
    let end = start + 21 * DAY_MS
    let existing = await pool.query(
      'SELECT day FROM appointoffering WHERE resource_id = $1 AND day >= $2 AND day < $3',
      [resourceId, start, end],
    )
    let have = new Set(existing.rows.map((row) => Number(row.day)))
    let now = Date.now()
    for (let i = 0; i < 21; i++) {
      let day = start + i * DAY_MS
      if (have.has(day)) continue
      await pool.query(
        "INSERT INTO appointoffering (day, resource_id, during, created_at, updated_at) VALUES ($1::bigint, $2, int4range(0, 1440, '[)'), $3, $3)",
        [day, resourceId, now],
      )
      insertedDays.push(day)
    }
  }

  it('keeps a toast mounted and visible through a week frame swap', async (t) => {
    await seedThreeWeeks()

    let auth = await createAuthCookieWithCsrfForUser('user@newapp.com')
    assert.ok(auth?.cookie, 'user session must be created')

    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page
      .context()
      .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])

    // A full document navigation fires a load event; a same-document frame swap
    // does not. Counting loads is how the test tells the two apart.
    let loads = 0
    page.on('load', () => {
      loads++
    })

    await page.goto(routes.appointment.index.href() + '?resource_id=' + resourceId)
    await page.locator('[data-toast-host-ready]').waitFor({ state: 'attached', timeout: 15_000 })

    let headers = page.locator('[data-day-date]')
    await headers.first().waitFor({ timeout: 15_000 })
    let previousFirst = Number(await headers.first().getAttribute('data-day-date'))
    assert.ok(Number.isFinite(previousFirst), 'the grid should expose its first day')

    // A full reload would wipe this probe.
    await page.evaluate(() => {
      window.__toastSurvivalProbe = 'alive'
    })

    await page.evaluate((eventName) => {
      document.dispatchEvent(
        new CustomEvent(eventName, {
          detail: { message: 'Frame-Wechsel überlebt', tone: 'success' },
        }),
      )
    }, TOAST_EVENT)
    await page.locator('#__toast-root').waitFor({ timeout: 5_000 })

    await page.locator('a[aria-label="Nächste Woche"]').click()

    await page.waitForFunction(
      (previous) => {
        let first = document.querySelector('[data-day-date]')
        return (
          first != null && Number(first.getAttribute('data-day-date')) === previous + 7 * 86_400_000
        )
      },
      previousFirst,
      { timeout: 15_000 },
    )
    let nextFirst = Number(await headers.first().getAttribute('data-day-date'))
    assert.equal(nextFirst - previousFirst, 7 * DAY_MS, 'the grid should advance exactly one week')

    assert.equal(loads, 1, 'the toast must survive a frame swap, not a document reload')
    assert.equal(
      await page.evaluate(() => window.__toastSurvivalProbe),
      'alive',
      'the document must not have reloaded',
    )
    assert.ok(
      (await page.locator('#app-overlay-root').textContent())?.includes('Frame-Wechsel überlebt'),
      'the toast is still rendered inside the shell overlay root',
    )
  })
})
