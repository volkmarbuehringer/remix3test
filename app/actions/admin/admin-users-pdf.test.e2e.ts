import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'
import { readFile } from 'node:fs/promises'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../test-router.ts'
import { initializeAppDatabase } from '../../db.ts'
import { createAuthCookieWithCsrfForUser } from '../../../test/utils.ts'
import { routes } from '../../routes.ts'

// ---------------------------------------------------------------------------
// /admin/users PDF output — end-to-end behavior.
//
// Opens the users grid inside the admin frame, then clicks the header "PDF
// exportieren" link. The link carries data-rmx-document, so the browser
// performs a document navigation and turns the attachment response into a real
// download; if the frame runtime swallowed it, no download event would fire.
//
// Requires a running PostgreSQL database (global test setup) and a Playwright
// browser. Runs as CI-only (gated on `type: ["e2e"]`).
// ---------------------------------------------------------------------------

describe('admin users PDF export', () => {
  let adminCookie = ''

  before(async () => {
    await initializeAppDatabase()
    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')
    adminCookie = auth!.cookie
  })

  it('downloads the filtered, sorted users through the admin frame', async (t) => {
    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page
      .context()
      .addCookies([{ name: 'session', value: adminCookie.slice(8), url: server.baseUrl }])
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(routes.admin.users.index.href() + '?filter=admin&sort=email&order=desc')

    let link = page.locator('[data-users-pdf]')
    await link.waitFor({ timeout: 15_000 })
    let href = await link.getAttribute('href')
    assert.ok(href?.includes('filter=admin'), 'the link should carry the search term')
    assert.ok(href?.includes('sort=email'), 'the link should carry the sort column')
    assert.ok(href?.includes('order=desc'), 'the link should carry the sort direction')

    let downloadPromise = page.waitForEvent('download', { timeout: 15_000 })
    await link.click()
    let download = await downloadPromise

    assert.ok(
      download.suggestedFilename().startsWith('benutzer-') &&
        download.suggestedFilename().endsWith('.pdf'),
      'the download must be the users PDF attachment',
    )
    assert.ok(
      download.url().includes('filter=admin'),
      'the export URL must carry the current filter',
    )

    let path = await download.path()
    assert.ok(path, 'download must produce a file on disk')
    let bytes = await readFile(path!)
    assert.equal(bytes.subarray(0, 4).toString('latin1'), '%PDF')
  })
})
