import { describe, it, before, after } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../test-router.ts'
import { initializeAppDatabase } from '../../db.ts'
import { pool } from '../../data/test-pool.ts'
import { createAuthCookieWithCsrfForUser } from '../../test-utils.ts'

// ---------------------------------------------------------------------------
// /lists list-level operations (client entry e2e).
//
// Exercises the product surface added on top of the basic editor in a real
// browser: the sort control, the "Nur Erledigte löschen" and "Duplizieren"
// actions render, and — critically — the item label text is visible (a
// regression made the label collapse to ~0px when the row layout wrapped it in
// a flex column). The mutation behaviour of these operations and the per-item
// metadata model are covered by the data + controller tests; here we assert the
// client surface renders and the label bug stays fixed.
//
// Note: we deliberately avoid clicking the hover-reveal action-cluster buttons
// here — Firefox + Playwright synthetic pointer events are unreliable for them
// and make such interactions flaky across browsers.
// ---------------------------------------------------------------------------

describe('lists list-level operations', () => {
  let adminCookie: string
  let adminUserId: number
  let listId: number

  before(async () => {
    await initializeAppDatabase()

    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')
    adminCookie = auth!.cookie

    let userRows = (await pool.query('SELECT id FROM users WHERE email = $1', ['admin@newapp.com']))
      .rows as { id: number }[]
    assert.ok(userRows.length > 0, 'admin user must exist')
    adminUserId = Number(userRows[0]!.id)

    let now = Date.now()
    let items = JSON.stringify([
      { id: 'op-done', label: 'Erledigte Aufgabe', done: true },
      { id: 'op-open', label: 'Offene Aufgabe' },
    ])
    let result = await pool.query(
      'INSERT INTO lists (user_id, title, description, list, created_at, updated_at) VALUES ($1, $2, $3, $4::jsonb, $5, $5) RETURNING id',
      [adminUserId, 'ops e2e list', 'seeded for operations e2e', items, now],
    )
    listId = Number(result.rows[0]!.id as number)
  })

  after(async () => {
    await pool.query('DELETE FROM lists WHERE id = $1', [listId])
  })

  it('renders the list-level toolbar and shows item label text', async (t) => {
    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page
      .context()
      .addCookies([{ name: 'session', value: adminCookie.slice(8), url: server.baseUrl }])

    await page.goto(`/lists?load=${listId}`)

    // The list-level toolbar surface renders once the client entry hydrates:
    // the sort control, the clear-completed action, the duplicate action.
    await page.locator('select[aria-label="Sortieren"]').waitFor({ timeout: 15_000 })
    assert.ok((await page.locator('button:has-text("Nur Erledigte löschen")').count()) >= 1)
    assert.ok((await page.locator('button:has-text("Duplizieren")').count()) >= 1)
    assert.ok((await page.locator('[data-item-id="op-done"]').count()) === 1)

    // The item label must render with a real height — a regression here makes
    // the element text collapse to ~0px and disappear.
    let labelBox = await page
      .locator('[data-item-id="op-open"] span', { hasText: 'Offene Aufgabe' })
      .first()
      .boundingBox()
    assert.ok(
      labelBox != null && labelBox.height > 10,
      'item label should be visible (not collapsed)',
    )
  })
})
