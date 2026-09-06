import { describe, it, before, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../../test-router.ts'
import { routes } from '../../../routes.ts'
import { createAuthCookieWithCsrfForUser } from '../../../test-utils.ts'
import { db, initializeAppDatabase } from '../../../db.ts'
import { pool } from '../../../data/test-pool.ts'
import { insertUpload, claimUploads } from '../../../data/uploads.ts'

// ---------------------------------------------------------------------------
// /admin/uploads multirow delete — end-to-end behavior.
//
// Loads the uploads grid in the admin-content frame (a full-page GET of the
// route renders a <Frame> backing the admin sidebar shell), selects a couple of
// rows, confirms the bulk delete dialog, and verifies the POST /delete-many
// redirect is followed in-frame so the "N Dateien gelöscht." banner renders.
//
// Requires a running PostgreSQL database (global test setup) and a Playwright
// browser. Runs as CI-only (gated on `type: ["e2e"]`).
// ---------------------------------------------------------------------------

describe('admin uploads: multirow delete banner', () => {
  let adminId: number

  before(async () => {
    await initializeAppDatabase()
    let result = await db.exec("SELECT id FROM users WHERE email = 'admin@newapp.com'")
    adminId = Number((result.rows?.[0] as { id: number } | undefined)?.id)
    assert.ok(Number.isFinite(adminId), 'expected seeded admin@newapp.com to exist')
  })

  afterEach(async () => {
    await pool.query("DELETE FROM uploads WHERE filename LIKE 'test-e2e-%'")
  })

  it('deletes the selected rows and shows the deleted banner in-frame', async (t) => {
    let ids: number[] = []
    for (let i = 1; i <= 3; i++) {
      let id = Number(
        await insertUpload(db, {
          filename: `test-e2e-${i}.txt`,
          mimeType: 'text/plain',
          buffer: Buffer.from(`x${i}`),
          size: i,
          now: Date.now(),
        }),
      )
      ids.push(id)
    }
    let claimed = await claimUploads(db, ids, adminId, Number.MAX_SAFE_INTEGER)
    assert.ok(claimed, 'seeded uploads must be claimed by the admin')

    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')

    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page
      .context()
      .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])

    await page.goto(routes.admin.uploads.index.href())

    // A full-page GET of /admin/uploads renders the admin-content frame, which
    // then fetches the page fragment (sidebar shell + grid). Wait for the table.
    let table = page.locator('[data-uploads-table]')
    await table.waitFor({ timeout: 15_000 })

    let rowCheckboxes = page.locator('[data-uploads-table] input[name="ids"]')
    assert.equal(await rowCheckboxes.count(), 3, 'grid should render one checkbox per row')

    // Accept the native confirm() dialog the clientEntry shows on submit.
    let confirmMessage = ''
    page.once('dialog', (dialog) => {
      confirmMessage = dialog.message()
      dialog.accept()
    })

    let bulkButton = page.locator('[data-bulk-delete-form] button[type="submit"]')
    // The bulk button starts disabled; checking rows enables it (the clientEntry
    // updates the count). Click the first two rows after waiting for the count.
    await rowCheckboxes.nth(0).check()
    await rowCheckboxes.nth(1).check()
    await page.locator('[data-selected-count]').filter({ hasText: '2 ausgewählt' }).waitFor({
      timeout: 10_000,
    })
    await bulkButton.click()

    // The POST to /delete-many redirects; frameRedirects follows it in-frame and
    // re-fetches the grid with `deleted=N`, so the banner appears and shows the count.
    let banner = page.locator('[data-deleted-banner]')
    await banner.waitFor({ timeout: 15_000 })
    assert.equal(await banner.textContent(), '2 Dateien gelöscht.')
    assert.ok(confirmMessage.includes('2 Dateien wirklich löschen?'), `got: ${confirmMessage}`)

    // Both selected rows are gone; the third remains. The grid still renders.
    let remainingRows = await page.locator('[data-uploads-table] tbody tr').count()
    assert.equal(remainingRows, 1, 'one of three uploads should remain')
  })
})
