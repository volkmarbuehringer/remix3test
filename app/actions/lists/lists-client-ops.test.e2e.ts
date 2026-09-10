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

// ---------------------------------------------------------------------------
// /lists merge via sidebar drag (client entry e2e).
//
// Exercises the list-to-list drag gesture: dragging sidebar list A onto sidebar
// list B copies A's items into B after a confirmation prompt. We dispatch
// synthetic DragEvents (rather than Playwright's mouse-based dragAndDrop) so the
// test is deterministic across Chromium and Firefox — Firefox synthetic pointer
// events are unreliable for these rows.
// ---------------------------------------------------------------------------

describe('lists merge via sidebar drag', () => {
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

  // Seed a fresh source (two items) + target (one item) per test so a merged
  // target from one test never leaks into the next.
  async function seedLists() {
    let now = Date.now()
    let sourceItems = JSON.stringify([
      { id: 'merge-src-1', label: 'Quell Eintrag 1' },
      { id: 'merge-src-2', label: 'Quell Eintrag 2' },
    ])
    let targetItems = JSON.stringify([{ id: 'merge-tgt-1', label: 'Ziel Eintrag' }])

    let sourceResult = await pool.query(
      'INSERT INTO lists (user_id, title, description, list, created_at, updated_at) VALUES ($1, $2, $3, $4::jsonb, $5, $5) RETURNING id',
      [adminUserId, 'merge source', 'seeded source for merge drag e2e', sourceItems, now],
    )
    let sourceId = Number(sourceResult.rows[0]!.id as number)

    let targetResult = await pool.query(
      'INSERT INTO lists (user_id, title, description, list, created_at, updated_at) VALUES ($1, $2, $3, $4::jsonb, $5, $5) RETURNING id',
      [adminUserId, 'merge target', 'seeded target for merge drag e2e', targetItems, now],
    )
    let targetId = Number(targetResult.rows[0]!.id as number)

    return { sourceId, targetId }
  }

  function dragList(page: { evaluate: Function }, fromId: number, toId: number) {
    return page.evaluate(
      ({ sourceSel, targetSel }: { sourceSel: string; targetSel: string }) => {
        let source = document.querySelector(sourceSel) as HTMLElement
        let target = document.querySelector(targetSel) as HTMLElement
        if (!source || !target) throw new Error('drag source or target row missing')
        let dt = new DataTransfer()
        source.dispatchEvent(
          new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }),
        )
        target.dispatchEvent(
          new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }),
        )
        target.dispatchEvent(
          new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }),
        )
      },
      { sourceSel: `[data-list-id="${fromId}"]`, targetSel: `[data-list-id="${toId}"]` },
    )
  }

  it('merges a dragged list into another after confirming and reloads the editor', async (t) => {
    let { sourceId, targetId } = await seedLists()
    try {
      let server = await createTestServer((request) => router.fetch(request))
      let page = await t.serve(server)
      await page
        .context()
        .addCookies([{ name: 'session', value: adminCookie.slice(8), url: server.baseUrl }])

      await page.goto(`/lists?load=${targetId}`)
      await page.locator('#lists-title').waitFor({ timeout: 15_000 })
      await page.locator(`[data-list-id="${sourceId}"]`).waitFor({ timeout: 15_000 })

      // Accept the confirmation gate. Overriding window.confirm keeps the test
      // deterministic across browsers — a real modal dialog opened from inside
      // page.evaluate is not reliably accepted by Playwright. Must run after the
      // navigation, which resets the top document.
      await page.evaluate(() => {
        window.confirm = () => true
      })

      // The client entry hydrates lazily (deferred import map, notably slow in
      // Firefox), and only then registers its drag listeners. Retry the drag
      // until the merge lands so the test does not race hydration. A retry
      // before hydration is a no-op (no listeners), and we stop at the first
      // successful merge, so the target is never merged twice.
      let merged = false
      for (let attempt = 0; attempt < 20 && !merged; attempt++) {
        await dragList(page, sourceId, targetId)
        await page.waitForTimeout(750)
        let targetRow = await pool.query('SELECT list FROM lists WHERE id = $1', [targetId])
        merged = (targetRow.rows[0]!.list as Array<Record<string, unknown>>).length === 3
      }
      assert.ok(merged, 'the merge should land once the client hydrates')

      // The frame reloads after the merge — the editor must now render three items.
      await page.waitForFunction(
        (expected) => document.querySelectorAll('[data-item-id]').length === expected,
        3,
        { timeout: 15_000 },
      )
      assert.equal(await page.locator('[data-item-id]').count(), 3)
    } finally {
      await pool.query('DELETE FROM lists WHERE id = $1', [sourceId])
      await pool.query('DELETE FROM lists WHERE id = $1', [targetId])
    }
  })

  it('does not merge when the confirmation is declined', async (t) => {
    let { sourceId, targetId } = await seedLists()
    try {
      let server = await createTestServer((request) => router.fetch(request))
      let page = await t.serve(server)
      await page
        .context()
        .addCookies([{ name: 'session', value: adminCookie.slice(8), url: server.baseUrl }])

      await page.goto(`/lists?load=${targetId}`)
      await page.locator('#lists-title').waitFor({ timeout: 15_000 })
      await page.locator(`[data-list-id="${sourceId}"]`).waitFor({ timeout: 15_000 })

      await page.evaluate(() => {
        window.confirm = () => false
      })

      await dragList(page, sourceId, targetId)

      // Give a (wrong) merge a moment to land, then assert nothing changed.
      await page.waitForTimeout(1000)
      assert.equal(await page.locator('[data-item-id]').count(), 1)
    } finally {
      await pool.query('DELETE FROM lists WHERE id = $1', [sourceId])
      await pool.query('DELETE FROM lists WHERE id = $1', [targetId])
    }
  })
})
