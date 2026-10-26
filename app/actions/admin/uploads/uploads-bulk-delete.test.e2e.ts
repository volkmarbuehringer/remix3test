import { describe, it, before, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../../test-router.ts'
import { routes } from '../../../routes.ts'
import { createAuthCookieWithCsrfForUser } from '../../../../test/utils.ts'
import { db, initializeAppDatabase } from '../../../db.ts'
import { pool } from '../../../../test/pool.ts'
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

    // Other uploads e2e files (e.g. the multirow download test) may be writing
    // rows into the shared grid in parallel, so only require our three rows to
    // be present and scope every assertion to our own filenames (see the
    // remix3-tooling (§ Testing) `references/remix3-testing/parallel-test-interference.md` pattern).
    let rowCheckboxes = page.locator('[data-uploads-table] input[name="ids"]')
    assert.ok(
      (await rowCheckboxes.count()) >= 3,
      'grid should render a checkbox for each of our rows',
    )

    // The bulk-delete clientEntry attaches its row listeners asynchronously after
    // the table renders (and re-runs `init()` on every frame `reloadComplete`).
    // A click landing in that re-attach window is dropped and then reverted by
    // the store re-sync, which surfaces as `locator.check: Clicking the checkbox
    // did not change its state`. Wait for its hydration marker first, as the
    // sibling `uploads-bulk-download.test.e2e.ts` does.
    // The toolbar is intentionally hidden while nothing is selected, so the
    // hydration marker only has to be attached, not visible.
    let bulkReady = page.locator('[data-bulk-delete-form][data-bulk-delete-ready]')
    await bulkReady.waitFor({ state: 'attached', timeout: 15_000 })

    // The bulk toolbar stays out of the way until something is selected, so the
    // page starts without a permanently visible "0 ausgewählt" action row.
    let bulkGroup = page.locator('[data-bulk-group]')
    await bulkGroup.waitFor({ state: 'hidden', timeout: 5_000 })

    // The bulk form confirms through the page's shared (styled) confirm dialog,
    // so wait for that entry to hydrate before submitting.
    await page.locator('[data-confirm-ready]').waitFor({ state: 'attached', timeout: 15_000 })

    let bulkButton = page.locator('[data-bulk-delete-form] button[type="submit"]')
    // The bulk button starts disabled; checking rows enables it (the clientEntry
    // updates the count). Select two specific rows by filename — the grid sorts
    // newest-first, so row order is not insertion order.
    await page.locator('[data-upload-filename="test-e2e-1.txt"] input[name="ids"]').check()
    await page.locator('[data-upload-filename="test-e2e-2.txt"] input[name="ids"]').check()
    await page.locator('[data-selected-count]').filter({ hasText: '2 ausgewählt' }).waitFor({
      timeout: 10_000,
    })
    await bulkGroup.waitFor({ state: 'visible', timeout: 5_000 })
    await bulkButton.click()

    // Confirm through the shared dialog instead of a native window.confirm.
    let confirmDialog = page.locator('[data-confirm-dialog]')
    await confirmDialog.waitFor({ timeout: 15_000 })
    let confirmMessage = await page.locator('#confirm-delete-message').innerText()
    assert.ok(confirmMessage.includes('2 Dateien wirklich löschen?'), `got: ${confirmMessage}`)
    await page.locator('[data-confirm-accept]').click()

    // The POST to /delete-many redirects; frameRedirects follows it in-frame and
    // re-fetches the grid with `deleted=N`, so the banner appears and shows the count.
    let banner = page.locator('[data-deleted-banner]')
    await banner.waitFor({ timeout: 15_000 })
    assert.equal(await banner.textContent(), '2 Dateien gelöscht.')

    // Both selected rows are gone; the third remains. Assert by filename so
    // parallel rows from other uploads tests do not affect the outcome.
    assert.equal(
      await page.locator('[data-upload-filename="test-e2e-1.txt"]').count(),
      0,
      'the first selected upload should be gone',
    )
    assert.equal(
      await page.locator('[data-upload-filename="test-e2e-2.txt"]').count(),
      0,
      'the second selected upload should be gone',
    )
    assert.equal(
      await page.locator('[data-upload-filename="test-e2e-3.txt"]').count(),
      1,
      'the unselected upload should remain',
    )

    // Regression: a second bulk delete right after the first must also work. The
    // frame reload replaces the form/table, so the clientEntry has to re-attach
    // to the new nodes — otherwise selecting rows a second time leaves the
    // button disabled and nothing can be deleted. The replaced form starts
    // without the hydration marker, so wait for the new one.
    await bulkReady.waitFor({ state: 'attached', timeout: 15_000 })
    await page.locator('[data-confirm-ready]').waitFor({ state: 'attached', timeout: 15_000 })
    await page.locator('[data-upload-filename="test-e2e-3.txt"] input[name="ids"]').check()
    await page.locator('[data-selected-count]').filter({ hasText: '1 ausgewählt' }).waitFor({
      timeout: 10_000,
    })
    await bulkButton.click()
    await page.locator('[data-confirm-dialog]').waitFor({ timeout: 15_000 })
    await page.locator('[data-confirm-accept]').click()
    let secondBanner = page
      .locator('[data-deleted-banner]')
      .filter({ hasText: '1 Datei gelöscht.' })
    await secondBanner.waitFor({ timeout: 15_000 })
    assert.equal(await secondBanner.textContent(), '1 Datei gelöscht.')
    assert.equal(
      await page.locator('[data-upload-filename="test-e2e-3.txt"]').count(),
      0,
      'the last upload should be gone after the second delete',
    )
  })

  it('deletes exactly the confirmed rows when the selection grows while the dialog is open', async (t) => {
    let ids: number[] = []
    for (let i = 1; i <= 3; i++) {
      let id = Number(
        await insertUpload(db, {
          filename: `test-e2e-scope-${i}.txt`,
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
    await page.locator('[data-uploads-table]').waitFor({ timeout: 15_000 })
    await page.locator('[data-bulk-delete-form][data-bulk-delete-ready]').waitFor({
      state: 'attached',
      timeout: 15_000,
    })
    await page.locator('[data-confirm-ready]').waitFor({ state: 'attached', timeout: 15_000 })

    // Two rows are confirmed; the dialog names both.
    await page.locator('[data-upload-filename="test-e2e-scope-1.txt"] input[name="ids"]').check()
    await page.locator('[data-upload-filename="test-e2e-scope-2.txt"] input[name="ids"]').check()
    await page.locator('[data-selected-count]').filter({ hasText: '2 ausgewählt' }).waitFor({
      timeout: 10_000,
    })
    await page.locator('[data-bulk-delete-form] button[type="submit"]').click()
    await page.locator('[data-confirm-dialog]').waitFor({ timeout: 15_000 })
    assert.ok(
      (await page.locator('#confirm-delete-message').innerText()).includes(
        '2 Dateien wirklich löschen?',
      ),
      'the dialog should name the confirmed count',
    )

    // The native modal now makes the grid inert, so keyboard/AT users cannot
    // reach the rows behind it. Verify that, then mutate the selection
    // programmatically to keep covering the frozen-id payload (a script or a
    // buggy AT could still change it): before the formdata rewrite the second
    // submit pass re-read the live selection, so this row was deleted even
    // though the dialog never mentioned it.
    let backgroundFocused = await page.evaluate(() => {
      let cb = document.querySelector<HTMLInputElement>(
        '[data-upload-filename="test-e2e-scope-3.txt"] input[name="ids"]',
      )
      cb?.focus()
      return document.activeElement === cb
    })
    assert.equal(backgroundFocused, false, 'the modal must make the grid inert')

    await page.evaluate(() => {
      let cb = document.querySelector<HTMLInputElement>(
        '[data-upload-filename="test-e2e-scope-3.txt"] input[name="ids"]',
      )
      if (!cb) throw new Error('missing third row checkbox')
      cb.checked = true
      cb.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await page.locator('[data-selected-count]').filter({ hasText: '3 ausgewählt' }).waitFor({
      timeout: 10_000,
    })

    await page.locator('[data-confirm-accept]').click()

    // Exactly the two confirmed rows are deleted...
    let banner = page.locator('[data-deleted-banner]')
    await banner.waitFor({ timeout: 15_000 })
    assert.equal(await banner.textContent(), '2 Dateien gelöscht.')
    assert.equal(
      await page.locator('[data-upload-filename="test-e2e-scope-1.txt"]').count(),
      0,
      'the first confirmed row should be gone',
    )
    assert.equal(
      await page.locator('[data-upload-filename="test-e2e-scope-2.txt"]').count(),
      0,
      'the second confirmed row should be gone',
    )
    // ...and the row added after the dialog opened must survive.
    assert.equal(
      await page.locator('[data-upload-filename="test-e2e-scope-3.txt"]').count(),
      1,
      'a row selected while the dialog was open must not be deleted',
    )
  })
})
