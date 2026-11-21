import { describe, it, before, type TestContext } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../test-router.ts'
import { routes } from '../../routes.ts'
import { createAuthCookieWithCsrfForUser } from '../../../test/utils.ts'
import { initializeAppDatabase } from '../../db.ts'

// ---------------------------------------------------------------------------
// /verwaltung/offerings row actions: the persistent kebab reveals the
// configuration/edit/delete cluster, mirroring the other admin grids.
//
// Requires a running PostgreSQL database (global test setup) and a Playwright
// browser. Runs as CI-only (gated on type: ["e2e"]).
// ---------------------------------------------------------------------------

describe('verwaltung offerings: row action menu', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  async function openOfferingsPage(t: TestContext) {
    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')

    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page
      .context()
      .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])
    // The default pending view is empty late in the week after the seeded
    // Monday–Friday slots have passed; "all" guarantees at least one row.
    await page.goto(routes.verwaltung.offerings.index.href() + '?status=all')
    await page.locator('[data-offerings-table] tbody tr[data-row-id]').first().waitFor({
      timeout: 15_000,
    })
    return page
  }

  it('reveals configuration from the persistent kebab overlay', async (t) => {
    let page = await openOfferingsPage(t)
    let firstRow = page.locator('[data-offerings-table] tbody tr[data-row-id]').first()

    let trigger = firstRow.locator('[data-row-actions-trigger]')
    await trigger.waitFor({ timeout: 15_000 })
    await page
      .locator('[data-admin-row-actions-ready="true"]')
      .waitFor({ state: 'attached', timeout: 15_000 })
    await trigger.click()

    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-offerings-table] tbody tr[data-row-id] [data-row-actions-trigger]')
          ?.getAttribute('aria-expanded') === 'true',
      undefined,
      { timeout: 15_000 },
    )
    await firstRow.locator('a[aria-label="Konfiguration"]').click()
    await page.waitForFunction(
      () => new URL(location.href).searchParams.get('config') !== null,
      undefined,
      { timeout: 15_000 },
    )
    await page.locator('select[name="_resource_display"]').waitFor({ timeout: 15_000 })
  })
})
