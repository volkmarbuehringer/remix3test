import { afterEach, before, describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../../test-router.ts'
import { routes } from '../../../routes.ts'
import { createAuthCookieWithCsrfForUser } from '../../../test-utils.ts'
import { claimUploads, insertUpload } from '../../../data/uploads.ts'
import { db, initializeAppDatabase } from '../../../db.ts'
import { pool } from '../../../data/test-pool.ts'

// ---------------------------------------------------------------------------
// Row context menu — real clientEntry hydration.
//
// The shared `createRowContextMenu` factory is wrapped by each menu's
// `clientEntry`. The direct-render browser suite drives the component, but only
// this e2e path loads the built browser module, hydrates the named export, and
// attaches the delegated `contextmenu` listener. It guards the factory wiring
// (entry export resolution + hydration) that a direct render cannot.
// ---------------------------------------------------------------------------

describe('admin uploads: row context menu hydrates', () => {
  let adminId: number

  before(async () => {
    await initializeAppDatabase()
    let result = await db.exec("SELECT id FROM users WHERE email = 'admin@newapp.com'")
    adminId = Number((result.rows?.[0] as { id: number } | undefined)?.id)
    assert.ok(Number.isFinite(adminId), 'expected seeded admin@newapp.com to exist')
  })

  afterEach(async () => {
    await pool.query("DELETE FROM uploads WHERE filename LIKE 'test-e2e-menu-%'")
  })

  it('opens the menu on right-click and deletes through the row form', async (t) => {
    // Unique per run: the chromium and firefox projects hit the same database.
    let filename = `test-e2e-menu-${Date.now()}.txt`
    let id = Number(
      await insertUpload(db, {
        filename,
        mimeType: 'text/plain',
        buffer: Buffer.from('x'),
        size: 1,
        now: Date.now(),
      }),
    )
    let claimed = await claimUploads(db, [id], adminId, Number.MAX_SAFE_INTEGER)
    assert.ok(claimed, 'seeded upload must be claimed by the admin')

    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')

    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page
      .context()
      .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])
    await page.goto(routes.admin.uploads.index.href())

    let row = page.locator(`[data-upload-filename="${filename}"]`)
    await row.waitFor({ timeout: 15_000 })

    // The factory sets this from its ref callback once the hydrated entry has
    // attached the delegated listener. The trigger is intentionally invisible,
    // so wait for it to be attached rather than visible.
    await page.locator('[data-row-context-menu-ready]').waitFor({ state: 'attached', timeout: 15_000 })

    await row.click({ button: 'right' })

    let deleteItem = page.locator('[role="menu"]').getByText('Löschen', { exact: true })
    await deleteItem.waitFor({ timeout: 10_000 })

    let confirmMessage = ''
    page.once('dialog', (dialog) => {
      confirmMessage = dialog.message()
      void dialog.accept()
    })
    await deleteItem.click()

    await row.waitFor({ state: 'detached', timeout: 15_000 })
    assert.ok(
      confirmMessage.includes(filename),
      `delete confirmation should name the row, got: ${confirmMessage}`,
    )
  })
})
