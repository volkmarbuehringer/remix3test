import { describe, it, before, type TestContext } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../test-router.ts'
import { routes } from '../../routes.ts'
import { createAuthCookieWithCsrfForUser } from '../../../test/utils.ts'
import { initializeAppDatabase } from '../../db.ts'

// ---------------------------------------------------------------------------
// /verwaltung/offerings row actions: the primary edit action stays visible and
// the per-row kebab opens the secondary configuration/delete menu.
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

  it('keeps edit direct and opens configuration from the kebab menu', async (t) => {
    let page = await openOfferingsPage(t)
    let firstRow = page.locator('[data-offerings-table] tbody tr[data-row-id]').first()

    await firstRow.locator('a[aria-label="Bearbeiten"]').waitFor({ timeout: 15_000 })
    await firstRow
      .locator('[data-offerings-row-menu-trigger][data-offerings-row-menu-ready="true"]')
      .waitFor({ timeout: 15_000 })
    await firstRow.locator('[data-offerings-row-menu-trigger]').click()

    await page.waitForFunction(
      () =>
        document
          .querySelector(
            '[data-offerings-table] tbody tr[data-row-id] [data-offerings-row-menu-trigger]',
          )
          ?.getAttribute('aria-expanded') === 'true',
      undefined,
      { timeout: 15_000 },
    )
    await firstRow.getByRole('menuitem', { name: 'Konfiguration' }).click()
    await page.waitForFunction(
      () => new URL(location.href).searchParams.get('config') !== null,
      undefined,
      { timeout: 15_000 },
    )
    await page.locator('select[name="_resource_display"]').waitFor({ timeout: 15_000 })
  })
})
