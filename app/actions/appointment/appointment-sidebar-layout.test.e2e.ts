import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../test-router.ts'
import { routes } from '../../routes.ts'
import { createAuthCookieWithCsrfForUser } from '../../../test/utils.ts'
import { initializeAppDatabase } from '../../db.ts'

// ---------------------------------------------------------------------------
// Appointment sidebar year/week picker widths.
//
// `selectYearStyle` uses `flex: 0.18` against the week select's `flex: 1`.
// Before remix #12121 the css() runtime serialized `0.18` as `flex: 0.18px`
// (a basis-only shorthand with grow 1), so both selects split the row ~50/50.
// Since #12121 it is the real shorthand and the year select stays narrow.
// Guard the intended ratio so a future css() serialization change is visible.
// ---------------------------------------------------------------------------

describe('appointment sidebar year/week picker', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  it('keeps the year select narrower than the week select', async (t) => {
    let auth = await createAuthCookieWithCsrfForUser('user@newapp.com')
    assert.ok(auth?.cookie, 'user session must be created')

    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page
      .context()
      .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])

    await page.goto(routes.appointment.index.href())
    await page.locator('[data-appointment-sidebar]').waitFor({ timeout: 15_000 })

    let widths = await page.evaluate(() => {
      let year = document.querySelector<HTMLElement>('select[name="year"]')
      let week = document.querySelector<HTMLElement>('select[name="week"]')
      return {
        year: year?.getBoundingClientRect().width ?? 0,
        week: week?.getBoundingClientRect().width ?? 0,
      }
    })

    assert.ok(widths.year > 0, `the year select needs a real width, got ${widths.year}px`)
    assert.ok(
      widths.year < widths.week,
      `the year select should stay narrower than week, got ${widths.year}px vs ${widths.week}px`,
    )
  })
})
