import { describe, it, before, after } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../test-router.ts'
import { initializeAppDatabase } from '../../db.ts'
import { pool } from '../../data/test-pool.ts'
import { createAuthCookieWithCsrfForUser } from '../../test-utils.ts'

// ---------------------------------------------------------------------------
// /lists deferred client-entry regression (Firefox single import map).
//
// The remix/ui runtime renders the initial document's combined <ImportMap>,
// but deferred client entries (ListsClient, ListsRowActions, ListNameEdit,
// ListsSidebarKeyboard, ListsSearch) discovered in a frame response are loaded
// later via a SECOND import map appended at runtime. Firefox honors only one
// import map per document and ignores the second, so the affected entries fail
// to resolve their bare-specifier imports and never execute — breaking the
// whole editor (add item, hover reveal, drag, textarea hydration). Chromium
// merges the maps and masks the bug.
//
// This test asserts BEHAVIOR (the ListsClient entry hydrates and an item can be
// added through it), not the presence of the polyfill. So it stays a permanent
// guard: even after Firefox ships native multiple-import-map support, older
// Firefox versions still break, and the polyfill path must keep working.
//
// Requires: a running PostgreSQL database (global test setup) and a Playwright
// browser. Runs as CI-only (gated on `type: ["e2e"]`).
// ---------------------------------------------------------------------------

describe('lists deferred client entries load across browsers', () => {
  let adminCookie: string
  let adminUserId: number
  let listId: number

  before(async () => {
    await initializeAppDatabase()

    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')
    adminCookie = auth!.cookie

    let userRows = (await pool.query('SELECT id FROM users WHERE email = $1', [
      'admin@newapp.com',
    ])).rows as { id: number }[]
    assert.ok(userRows.length > 0, 'admin user must exist')
    adminUserId = Number(userRows[0]!.id)

    let now = Date.now()
    let result = await pool.query(
      'INSERT INTO lists (user_id, title, description, list, created_at, updated_at) VALUES ($1, $2, $3, $4::jsonb, $5, $5) RETURNING id',
      [adminUserId, 'e2e-importmap-list', 'seeded for client-entry e2e', '[]', now],
    )
    listId = Number(result.rows[0]!.id as number)
  })

  after(async () => {
    await pool.query('DELETE FROM lists WHERE id = $1', [listId])
  })

  it('hydrates the ListsClient entry and adds an item through it', async (t) => {
    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page
      .context()
      .addCookies([{ name: 'session', value: adminCookie.slice(8), url: server.baseUrl }])

    // Load a specific list so the editor (ListsClient) hydrates from initial state.
    await page.goto(`/lists?load=${listId}`)

    // The title input is rendered by ListsClient — its presence proves the
    // deferred client entry executed (in Firefox it silently failed before the
    // multiple-import-maps polyfill).
    let titleInput = page.locator('#lists-title')
    await titleInput.waitFor({ timeout: 15_000 })

    // Type into the new-item textarea and add it via Enter. addItem() is pure
    // client logic in ListsClient; if the entry never executed this throws.
    // Use pressSequentially (real keystrokes) — the remix on('input') handler
    // that sets newItemLabel does not fire on Playwright's fill().
    let newItem = page.locator('textarea[placeholder="Neues Element eingeben…"]')
    await newItem.waitFor({ timeout: 15_000 })
    await newItem.click()
    await newItem.pressSequentially('e2e importmap item', { delay: 20 })
    await newItem.press('Enter')

    // The item must appear in the rendered list.
    let item = page.locator('[data-item-id]', { hasText: 'e2e importmap item' })
    await item.waitFor({ timeout: 15_000 })

    assert.ok((await item.count()) >= 1, 'the added item should be rendered by the client entry')
  })
})
