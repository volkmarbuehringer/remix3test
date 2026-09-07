import { describe, it, before, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { readFile } from 'node:fs/promises'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../../test-router.ts'
import { routes } from '../../../routes.ts'
import { createAuthCookieWithCsrfForUser } from '../../../test-utils.ts'
import { db, initializeAppDatabase } from '../../../db.ts'
import { pool } from '../../../data/test-pool.ts'
import { insertUpload, claimUploads } from '../../../data/uploads.ts'

// ---------------------------------------------------------------------------
// /admin/uploads multirow download — end-to-end behavior.
//
// Loads the uploads grid in the admin-content frame, selects a couple of rows,
// clicks the bulk download button, and verifies the browser downloads a ZIP
// archive (uploads.zip) containing the selected files. The bulk download form
// submits with `data-rmx-document`, so the submission is a native document
// navigation that the browser turns into a download instead of the frame
// runtime swallowing the attachment response.
//
// Runs in parallel with other uploads e2e files against the shared database,
// so it uses a distinct filename prefix (`test-bulkdl-`) and scopes every
// assertion to its own rows rather than the whole grid (see the
// remix-test-parallel-interference pattern).
//
// Requires a running PostgreSQL database (global test setup) and a Playwright
// browser. Runs as CI-only (gated on `type: ["e2e"]`).
// ---------------------------------------------------------------------------

describe('admin uploads: multirow download', () => {
  let adminId: number

  before(async () => {
    await initializeAppDatabase()
    let result = await db.exec("SELECT id FROM users WHERE email = 'admin@newapp.com'")
    adminId = Number((result.rows?.[0] as { id: number } | undefined)?.id)
    assert.ok(Number.isFinite(adminId), 'expected seeded admin@newapp.com to exist')
  })

  afterEach(async () => {
    await pool.query("DELETE FROM uploads WHERE filename LIKE 'test-bulkdl-%'")
  })

  it('downloads the selected rows as a zip archive', async (t) => {
    let ids: number[] = []
    for (let i = 1; i <= 3; i++) {
      let id = Number(
        await insertUpload(db, {
          filename: `test-bulkdl-${i}.txt`,
          mimeType: 'text/plain',
          buffer: Buffer.from(`content-${i}`),
          size: 9,
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

    // Other uploads e2e files may be writing rows into the shared grid in
    // parallel, so only require our three rows to be present.
    let rowCheckboxes = page.locator('[data-uploads-table] input[name="ids"]')
    assert.ok(
      (await rowCheckboxes.count()) >= 3,
      'grid should render a checkbox for each of our rows',
    )

    let downloadButton = page.locator('[data-bulk-download-form] button[type="submit"]')
    // The bulk download button starts disabled.
    assert.ok(await downloadButton.isDisabled(), 'bulk download button starts disabled')

    // The clientEntries attach their listeners asynchronously after the table
    // renders; interacting before that races hydration. Wait for the readiness
    // markers both clientEntries set on hydration.
    await page
      .locator('[data-bulk-delete-form][data-bulk-delete-ready]')
      .waitFor({ timeout: 15_000 })
    await page
      .locator('[data-bulk-download-form][data-bulk-download-ready]')
      .waitFor({ timeout: 15_000 })

    // Select two specific rows by filename (the grid sorts newest-first, so
    // row order is not insertion order). Row selection self-heals after a
    // re-render because the clientEntry re-reads the live checkbox state on
    // hydration, so a single poll suffices.
    await page.locator('[data-upload-filename="test-bulkdl-1.txt"] input[name="ids"]').check()
    await page.locator('[data-upload-filename="test-bulkdl-2.txt"] input[name="ids"]').check()
    await page.waitForFunction(
      () => {
        let btn = document.querySelector<HTMLButtonElement>(
          '[data-bulk-download-form] button[type="submit"]',
        )
        return !!btn && !btn.disabled
      },
      undefined,
      { timeout: 15_000 },
    )

    let downloadPromise = page.waitForEvent('download', { timeout: 15_000 })
    await downloadButton.click()
    let download = await downloadPromise

    assert.equal(download.suggestedFilename(), 'uploads.zip')

    let path = await download.path()
    assert.ok(path, 'download must produce a file on disk')
    let bytes = await readFile(path!)

    // PK\x03\x04 is the ZIP local-file-header signature.
    assert.equal(bytes.readUInt32LE(0), 0x04034b50, 'downloaded file should be a zip archive')
    let text = bytes.toString('utf8')
    assert.ok(text.includes('test-bulkdl-1.txt'), 'zip should contain the first selected file')
    assert.ok(text.includes('test-bulkdl-2.txt'), 'zip should contain the second selected file')
    assert.ok(!text.includes('test-bulkdl-3.txt'), 'unselected file must not be in the zip')
  })
})
