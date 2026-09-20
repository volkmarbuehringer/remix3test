import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../../test-router.ts'
import { routes } from '../../../routes.ts'
import { createAuthCookieWithCsrfForUser } from '../../../test-utils.ts'
import { initializeAppDatabase } from '../../../db.ts'

const MONTH_NAMES = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
]

// ---------------------------------------------------------------------------
// /verwaltung/report1 filter auto-submit (client entry e2e).
//
// The server test can only assert the `data-report1-filters` marker; this drives
// the real browser path: once the entry has hydrated, changing a select must
// re-run the report (URL + heading) with no button press.
// ---------------------------------------------------------------------------

describe('verwaltung report1 filter auto-submit', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  it('re-runs the report when a filter select changes', async (t) => {
    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')

    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page
      .context()
      .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])

    await page.goto(routes.verwaltung.report1.index.href())
    await page.locator('form[data-report1-filters]').waitFor({ timeout: 15_000 })

    // Pick a month that is not the current one, so a working auto-submit must
    // change both the URL and the heading.
    let currentMonth = new Date().getUTCMonth() + 1
    let targetMonth = currentMonth === 1 ? 2 : 1
    let targetName = MONTH_NAMES[targetMonth - 1]!

    // Hydration is async; retry the change until the entry has wired its
    // delegated listener and the report actually re-runs.
    let updated = false
    let deadline = Date.now() + 15_000
    while (!updated && Date.now() < deadline) {
      await page
        .locator('select[name="month"]')
        .selectOption(String(targetMonth))
        .catch(() => {})
      await page
        .locator('select[name="month"]')
        .dispatchEvent('change')
        .catch(() => {})
      try {
        await page.getByRole('heading', { name: new RegExp(targetName) }).waitFor({ timeout: 1000 })
        updated = true
      } catch {
        // not hydrated yet — try again
      }
    }

    assert.ok(updated, `changing the month should re-run the report (heading "${targetName}")`)
    assert.equal(
      new URL(page.url()).searchParams.get('month'),
      String(targetMonth),
      `URL should carry month=${targetMonth}, got ${page.url()}`,
    )
  })
})
