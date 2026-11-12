import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'
import { readFile } from 'node:fs/promises'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../test-router.ts'
import { initializeAppDatabase } from '../../db.ts'
import { pool } from '../../../test/pool.ts'
import { createAuthCookieWithCsrfForUser } from '../../../test/utils.ts'

// ---------------------------------------------------------------------------
// /lists view PDF export — end-to-end behavior.
//
// Opens a seeded list in the lists-content frame, narrows the view with the
// status tab and the sort select, and clicks the header "PDF exportieren" link.
// The link carries data-rmx-document, so the browser performs a document
// navigation and turns the attachment response into a real download; if the
// frame runtime swallowed it, no download event would fire.
//
// Requires a running PostgreSQL database (global test setup) and a Playwright
// browser. Runs as CI-only (gated on `type: ["e2e"]`).
// ---------------------------------------------------------------------------

describe('lists view PDF export', () => {
  let adminCookie: string
  let adminUserId: number

  before(async () => {
    await initializeAppDatabase()
    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')
    adminCookie = auth!.cookie
    let rows = (await pool.query('SELECT id FROM users WHERE email = $1', ['admin@newapp.com']))
      .rows as { id: number }[]
    assert.ok(rows.length > 0, 'admin user must exist')
    adminUserId = Number(rows[0]!.id)
  })

  async function seedList(): Promise<number> {
    let now = Date.now()
    let items = JSON.stringify([
      { id: 'pdf-open-z', label: 'Zeta offen' },
      { id: 'pdf-open-a', label: 'Alpha offen' },
      { id: 'pdf-done', label: 'Beta erledigt', done: true },
    ])
    let result = await pool.query(
      'INSERT INTO lists (user_id, title, description, list, created_at, updated_at) VALUES ($1, $2, $3, $4::jsonb, $5, $5) RETURNING id',
      [adminUserId, 'PDF view export', 'seeded for PDF e2e', items, now],
    )
    return Number(result.rows[0]!.id as number)
  }

  it('downloads the open list in the current view through the frame', async (t) => {
    let listId = await seedList()
    try {
      let server = await createTestServer((request) => router.fetch(request))
      let page = await t.serve(server)
      await page
        .context()
        .addCookies([{ name: 'session', value: adminCookie.slice(8), url: server.baseUrl }])
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto(`/lists?load=${listId}`)
      await page.locator('[data-status-bar]').waitFor({ timeout: 15_000 })
      await page
        .locator('[data-lists-ready="true"]')
        .waitFor({ state: 'attached', timeout: 15_000 })

      // The deferred ListsClient entry attaches the filter/sort handlers; wait
      // for its marker, then drive one click/select and wait for the export link
      // it updates.
      let statusHref = `/lists/${listId}/pdf?status=open`
      await page.locator('[data-status-filter="open"]').click()
      await page.waitForFunction(
        (want: string) =>
          document.querySelector('[data-list-pdf-view]')?.getAttribute('href') === want,
        statusHref,
        { timeout: 15_000 },
      )

      let sortedHref = `${statusHref}&sort=az`
      await page.selectOption('select[aria-label="Sortieren"]', 'az')
      await page.waitForFunction(
        (want: string) =>
          document.querySelector('[data-list-pdf-view]')?.getAttribute('href') === want,
        sortedHref,
        { timeout: 15_000 },
      )

      let downloadPromise = page.waitForEvent('download', { timeout: 15_000 })
      await page.locator('[data-list-pdf-view]').click()
      let download = await downloadPromise

      assert.ok(
        download.suggestedFilename().startsWith(`liste-${listId}-`) &&
          download.suggestedFilename().endsWith('.pdf'),
        'the download must be the list PDF attachment',
      )
      assert.ok(
        download.url().includes('status=open'),
        'the export URL must carry the status filter',
      )
      assert.ok(download.url().includes('sort=az'), 'the export URL must carry the view sort')

      let path = await download.path()
      assert.ok(path, 'download must produce a file on disk')
      let bytes = await readFile(path!)
      assert.equal(bytes.subarray(0, 4).toString('latin1'), '%PDF')
    } finally {
      await pool.query('DELETE FROM lists WHERE id = $1', [listId])
    }
  })
})
