import { describe, it, before, after } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../test-router.ts'
import { db, initializeAppDatabase } from '../../db.ts'
import { pool } from '../../../test/pool.ts'
import { listResources } from '../../data/resources.ts'
import { createAuthCookieWithCsrfForUser } from '../../../test/utils.ts'

// ---------------------------------------------------------------------------
// /appointment week navigation (client e2e).
//
// The grid is server-rendered from the frame's client-entry props. Only a
// browser can prove that a frame navigation hands the surviving grid entry the
// NEW props: the day headers are rendered by the grid itself, so if the entry
// kept the previous week's props they would not move.
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000

function currentMondayUtc(): number {
  let now = new Date()
  let dayOfWeek = now.getUTCDay() || 7
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dayOfWeek + 1)
}

describe('appointment grid week navigation', () => {
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

  /** Ensure both the current and next ISO weeks have bookable days. */
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

  it('advances the server-rendered grid when the next-week link is clicked', async (t) => {
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

    // The notification bell's unread-count fetch is the hydration signal used by
    // the appointments-new e2e: it runs only after the client runtime starts.
    let hydrated = page.waitForResponse(
      (response) => response.url().includes('/notifications/unread-count'),
      { timeout: 15_000 },
    )
    await page.goto('/appointment?resource_id=' + resourceId)
    await hydrated

    let headers = page.locator('[data-day-date]')
    await headers.first().waitFor({ timeout: 15_000 })
    let previousFirst = Number(await headers.first().getAttribute('data-day-date'))
    assert.ok(Number.isFinite(previousFirst), 'the grid should expose its first day')

    await page.locator('a[aria-label="Nächste Woche"]').click()

    // The grid must re-render from the frame's new props.
    await page.waitForFunction(
      (previous) => {
        let first = document.querySelector('[data-day-date]')
        return first != null && Number(first.getAttribute('data-day-date')) > previous
      },
      previousFirst,
      { timeout: 15_000 },
    )

    let nextFirst = Number(await headers.first().getAttribute('data-day-date'))
    assert.equal(nextFirst - previousFirst, 7 * DAY_MS, 'the grid should advance exactly one week')
    assert.equal(loads, 1, 'the week link must reload the frame, not the whole document')
  })
})
