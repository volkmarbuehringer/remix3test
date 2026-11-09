import { before, describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../test-router.ts'
import { initializeAppDatabase } from '../../db.ts'
import { pool } from '../../../test/pool.ts'
import { createAuthCookieWithCsrfForUser } from '../../../test/utils.ts'

// ---------------------------------------------------------------------------
// /lists reorder same-document View Transition (real browser).
//
// The browser suite stubs `startViewTransition` to observe each phase; this e2e
// proves the platform path: when `document.startViewTransition` exists it must
// start one transition, and when it does not the reorder must stay instant.
// Both current Playwright engines support same-document VT; only the
// cross-document form is Chromium-only. The helper is shared by drag and
// keyboard moves; clicking ↑/↓ exercises the same `applyListReorder` call
// without depending on synthetic drag events.
// ---------------------------------------------------------------------------

describe('lists reorder view transition', () => {
  let adminCookie: string
  let adminUserId: number

  before(async () => {
    await initializeAppDatabase()

    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')
    adminCookie = auth!.cookie

    let userRows = (await pool.query('SELECT id FROM users WHERE email = $1', ['admin@newapp.com']))
      .rows as { id: number }[]
    assert.ok(userRows.length > 0, 'admin user must exist')
    adminUserId = Number(userRows[0]!.id)
  })

  it('starts one transition when supported and degrades when it is not', async (t) => {
    let now = Date.now()
    let items = JSON.stringify([
      { id: 'vt-a', label: 'Alpha' },
      { id: 'vt-b', label: 'Beta' },
      { id: 'vt-c', label: 'Gamma' },
    ])
    let inserted = await pool.query(
      'INSERT INTO lists (user_id, title, description, list, created_at, updated_at) VALUES ($1, $2, $3, $4::jsonb, $5, $5) RETURNING id',
      [adminUserId, 'reorder transition', 'seeded for the reorder VT e2e', items, now],
    )
    let listId = Number(inserted.rows[0]!.id as number)

    try {
      let server = await createTestServer((request) => router.fetch(request))
      let page = await t.serve(server)
      await page
        .context()
        .addCookies([{ name: 'session', value: adminCookie.slice(8), url: server.baseUrl }])

      // Count explicit same-document transitions. Init scripts run before the
      // app entry, so the wrapper sees every reorder.
      await page.addInitScript(() => {
        let calls = 0
        let doc = document as unknown as {
          startViewTransition?: (update: () => void | Promise<void>) => unknown
        }
        let original = doc.startViewTransition
        let target = window as unknown as { __listVtCalls: () => number }
        target.__listVtCalls = () => calls
        if (typeof original === 'function') {
          doc.startViewTransition = (update) => {
            calls++
            return original.call(document, update)
          }
        }
      })

      await page.goto(`/lists?load=${listId}`)
      await page.locator('[data-item-id="vt-a"]').waitFor({ timeout: 15_000 })

      // The ↑/↓ click handlers attach with the deferred ListsClient entry; a
      // click in the hydration gap is a silent no-op, so retry until the order
      // lands (same hazard as the sort/status e2e helpers).
      let deadline = Date.now() + 15_000
      let moved = false
      while (Date.now() < deadline) {
        await page.evaluate(() => {
          let row = document.querySelector('[data-item-id="vt-a"]')
          let button = row?.querySelector<HTMLButtonElement>('button[aria-label="Nach unten"]')
          button?.click()
        })
        try {
          await page.waitForFunction(
            () =>
              [...document.querySelectorAll('[data-item-id]')]
                .map((el) => el.getAttribute('data-item-id'))
                .join(',') === 'vt-b,vt-a,vt-c',
            undefined,
            { timeout: 500 },
          )
          moved = true
          break
        } catch {
          await page.waitForTimeout(100)
        }
      }
      assert.equal(moved, true, 'the row must reorder')

      let calls = (await page.evaluate(() =>
        (window as unknown as { __listVtCalls: () => number }).__listVtCalls(),
      )) as number
      let supported = (await page.evaluate(
        () =>
          typeof (document as Document & { startViewTransition?: unknown }).startViewTransition ===
          'function',
      )) as boolean
      // Same-document VT is already in both current Playwright engines
      // (cross-document VT is the Chromium-only part). Assert the runtime
      // contract: one transition when the API exists, an instant fallback (no
      // calls) when it does not.
      assert.equal(
        calls,
        supported ? 1 : 0,
        supported
          ? 'the reorder must run in exactly one same-document view transition'
          : 'an unsupported platform must fall back to an instant reorder',
      )
    } finally {
      await pool.query('DELETE FROM lists WHERE id = $1', [listId])
    }
  })
})
