import { describe, it, before, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { readFile } from 'node:fs/promises'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../../test-router.ts'
import { db, initializeAppDatabase } from '../../../db.ts'
import { createAuthCookieWithCsrfForUser } from '../../../../test/utils.ts'
import { pool } from '../../../../test/pool.ts'
import { routes } from '../../../routes.ts'
import { claimUploads, insertUpload } from '../../../data/uploads.ts'

// ---------------------------------------------------------------------------
// /admin/uploads PDF export — end-to-end behavior.
//
// Opens the uploads grid inside the admin frame with a search and a sort, then
// clicks the toolbar "PDF exportieren" link. The link carries
// data-rmx-document, so the browser performs a document navigation and turns
// the attachment response into a real download; if the frame runtime swallowed
// it, no download event would fire.
//
// Requires a running PostgreSQL database (global test setup) and a Playwright
// browser. Runs as CI-only (gated on `type: ["e2e"]`).
// ---------------------------------------------------------------------------

describe('admin uploads PDF export', () => {
  let adminCookie = ''

  before(async () => {
    await initializeAppDatabase()
    // A crashed earlier run could leave duplicate seed rows behind; the
    // assertions never depend on counts, but start from a clean prefix anyway.
    await pool.query("DELETE FROM uploads WHERE filename LIKE 'test-pdf-export-%'")

    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')
    adminCookie = auth!.cookie

    let admin = await pool.query("SELECT id FROM users WHERE email = 'admin@newapp.com'")
    let adminId = Number(admin.rows[0]?.id)
    if (!Number.isFinite(adminId)) throw new Error('admin@newapp.com must exist')

    let ids: number[] = []
    for (let [filename, mimeType] of [
      ['test-pdf-export-alpha.pdf', 'application/pdf'],
      ['test-pdf-export-beta.txt', 'text/plain'],
    ] as const) {
      ids.push(
        Number(
          await insertUpload(db, {
            filename,
            mimeType,
            buffer: Buffer.from('x'),
            size: 1,
            now: Date.now(),
          }),
        ),
      )
    }
    let claimed = await claimUploads(db, ids, adminId, Number.MAX_SAFE_INTEGER)
    if (!claimed) throw new Error('Could not claim seeded uploads')
  })

  afterEach(async () => {
    await pool.query("DELETE FROM uploads WHERE filename LIKE 'test-pdf-export-%'")
  })

  it('downloads the filtered, sorted uploads through the admin frame', async (t) => {
    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page
      .context()
      .addCookies([{ name: 'session', value: adminCookie.slice(8), url: server.baseUrl }])
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(
      routes.admin.uploads.index.href() + '?filter=test-pdf-export&sort=filename&order=asc',
    )

    let link = page.locator('[data-uploads-pdf]')
    await link.waitFor({ timeout: 15_000 })
    let href = await link.getAttribute('href')
    assert.ok(href?.includes('filter=test-pdf-export'), 'the link should carry the search term')
    assert.ok(href?.includes('sort=filename'), 'the link should carry the sort column')
    assert.ok(href?.includes('order=asc'), 'the link should carry the sort direction')

    let downloadPromise = page.waitForEvent('download', { timeout: 15_000 })
    await link.click()
    let download = await downloadPromise

    assert.ok(
      download.suggestedFilename().startsWith('dateien-') &&
        download.suggestedFilename().endsWith('.pdf'),
      'the download must be the uploads PDF attachment',
    )
    assert.ok(
      download.url().includes('filter=test-pdf-export'),
      'the export URL must carry the current filter',
    )

    let path = await download.path()
    assert.ok(path, 'download must produce a file on disk')
    let bytes = await readFile(path!)
    assert.equal(bytes.subarray(0, 4).toString('latin1'), '%PDF')
  })
})
