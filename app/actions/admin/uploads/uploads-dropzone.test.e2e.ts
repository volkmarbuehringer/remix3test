import { describe, it, before, afterEach, type TestContext } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../../test-router.ts'
import { routes } from '../../../routes.ts'
import { createAuthCookieWithCsrfForUser } from '../../../test-utils.ts'
import { initializeAppDatabase } from '../../../db.ts'
import { pool } from '../../../data/test-pool.ts'

// ---------------------------------------------------------------------------
// /admin/uploads dropzone — frame-reload persistence, end-to-end.
//
// The dropzone's client interactions (click-to-open exactly once, drop -> themed
// chip, stray-drop cancellation, fileless drag passthrough, empty-submit
// validation) are covered by admin-uploads-dropzone.test.browser.tsx. What stays
// here is the half that needs a real Frame reload: every frame navigation
// replaces the server-rendered <input type="file">, and the selected files —
// bound to the replaced node — must survive it so the submit comes back enabled.
//
// Requires a running PostgreSQL database (global test setup) and a Playwright
// browser. Runs as CI-only (gated on `type: ["e2e"]`).
// ---------------------------------------------------------------------------

describe('admin uploads: dropzone frame-reload persistence', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  afterEach(async () => {
    await pool.query("DELETE FROM uploads WHERE filename LIKE 'test-consec-%'")
  })

  async function openUploadsPage(t: TestContext) {
    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')

    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page
      .context()
      .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])

    await page.goto(routes.admin.uploads.index.href())
    await page
      .locator('[data-upload-form][data-dropzone-ready="true"]')
      .waitFor({ timeout: 15_000 })
    return page
  }

  it('re-enables the upload button after a frame reload (consecutive uploads)', async (t) => {
    let page = await openUploadsPage(t)

    // Regression: the frame reload after an upload replaces (or reuses) the
    // server-rendered form, so the clientEntry has to re-initialize. A preserved
    // closure kept its in-flight flag set, which left "Hochladen" disabled after
    // selecting the next batch. Both uploads below must enable the submit.
    async function upload(name: string) {
      await page.setInputFiles('[data-file-input]', {
        name,
        mimeType: 'text/plain',
        buffer: Buffer.from(name),
      })
      await page.waitForFunction(
        () => !document.querySelector<HTMLButtonElement>('[data-upload-submit]')?.disabled,
        undefined,
        { timeout: 10_000 },
      )
      await page.locator('[data-upload-submit]').click()
      await page.locator(`[data-upload-filename="${name}"]`).waitFor({ timeout: 15_000 })
    }

    await upload('test-consec-1.txt')
    await upload('test-consec-2.txt')

    assert.equal(
      await page.locator('[data-upload-filename="test-consec-1.txt"]').count(),
      1,
      'the first upload should be listed',
    )
    assert.equal(
      await page.locator('[data-upload-filename="test-consec-2.txt"]').count(),
      1,
      'the second upload should be listed after the first frame reload',
    )
  })

  it('keeps a selected file across a frame navigation', async (t) => {
    let page = await openUploadsPage(t)

    // Regression: a frame navigation (filter/sort/paginate, or an SSE invalidate)
    // replaces the server-rendered file input. The selected files — bound to the
    // replaced node — must be restored, otherwise the submit comes back disabled
    // with the user's selection silently gone.
    await page.setInputFiles('[data-file-input]', {
      name: 'test-consec-keep.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('keep'),
    })
    await page.waitForFunction(
      () => !document.querySelector<HTMLButtonElement>('[data-upload-submit]')?.disabled,
      undefined,
      { timeout: 10_000 },
    )

    // Switch the kind filter: a frame-targeted navigation that re-renders the page.
    await page.locator('[data-kind-tabs] a').filter({ hasText: 'PDF' }).click()
    await page
      .locator('[data-upload-form][data-dropzone-ready="true"]')
      .waitFor({ timeout: 15_000 })
    await page.waitForFunction(
      () => {
        let list = document.querySelector('[data-pending-list]')
        let button = document.querySelector<HTMLButtonElement>('[data-upload-submit]')
        return (
          (list?.textContent ?? '').includes('test-consec-keep.txt') && !!button && !button.disabled
        )
      },
      undefined,
      { timeout: 10_000 },
    )
  })
})
