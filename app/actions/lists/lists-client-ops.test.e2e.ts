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
//
// The drag handlers only exist after the client entry hydrates (deferred import
// map, notably slow in some browsers) and the SSR markup looks identical before
// and after, so these tests drive the gesture until the confirmation prompt is
// observed — that is the signal that the handler ran. See `dragUntilPrompted`.
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

  // Override window.confirm and count its invocations in a DOM data attribute.
  // The count is how these tests observe that the client entry's drag handlers
  // actually ran: the listeners are registered by the entry's factory body, which
  // only executes once the deferred client module loads, and a synthetic drag
  // before that is a silent no-op. The toolbar is *server* rendered, so waiting
  // for it proves nothing about hydration.
  function installConfirm(page: { evaluate: Function }, accept: boolean) {
    return page.evaluate((result: boolean) => {
      let root = document.documentElement
      root.dataset.confirmCalls = '0'
      window.confirm = () => {
        root.dataset.confirmCalls = String(Number(root.dataset.confirmCalls ?? '0') + 1)
        return result
      }
    }, accept)
  }

  async function readConfirmCalls(page: { evaluate: Function }) {
    return (await page.evaluate(
      () => Number(document.documentElement.dataset.confirmCalls ?? '0'),
    )) as number
  }

  async function targetItemCount(listId: number) {
    let row = await pool.query('SELECT list FROM lists WHERE id = $1', [listId])
    return (row.rows[0]!.list as Array<Record<string, unknown>>).length
  }

  function dragList(
    page: { evaluate: Function },
    fromId: number,
    toId: number,
    options?: { dirtyTitle?: string },
  ) {
    return page.evaluate(
      ({
        sourceSel,
        targetSel,
        dirtyTitle,
      }: {
        sourceSel: string
        targetSel: string
        dirtyTitle: string | null
      }) => {
        // Optionally dirty the open list in the SAME synchronous task as the
        // drag, so the 1500ms autosave cannot save it first and the drop
        // handler's flushNow() is what bumps the source's updated_at.
        if (dirtyTitle !== null) {
          let input = document.querySelector('#lists-title') as HTMLInputElement | null
          if (!input) throw new Error('title input missing')
          input.value = dirtyTitle
          input.dispatchEvent(new Event('input', { bubbles: true }))
        }

        let source = document.querySelector(sourceSel) as HTMLElement | null
        let target = document.querySelector(targetSel) as HTMLElement | null
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
      {
        sourceSel: `[data-list-id="${fromId}"]`,
        targetSel: `[data-list-id="${toId}"]`,
        dirtyTitle: options?.dirtyTitle ?? null,
      },
    )
  }

  // Retry the gesture until the drop handler runs, which is observable as the
  // confirmation prompt. Pre-hydration attempts are no-ops, so the loop exits on
  // its first live dispatch; the merge tests stop there, so a merge is issued
  // exactly once and can never be double-applied by a retry. The declined test
  // relies on the returned count to prove the handler ran rather than passing
  // vacuously.
  async function dragUntilPrompted(
    page: { evaluate: Function; waitForTimeout: Function },
    fromId: number,
    toId: number,
    options?: { dirtyTitle?: string },
  ) {
    let calls = 0
    for (let attempt = 0; attempt < 60 && calls === 0; attempt++) {
      await dragList(page, fromId, toId, options)
      await page.waitForTimeout(250)
      calls = await readConfirmCalls(page)
    }
    assert.ok(calls > 0, 'the drag must be handled once the client entry hydrates')
    return calls
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
      await installConfirm(page, true)
      await dragUntilPrompted(page, sourceId, targetId)

      // The frame reloads after the merge — the editor must now render three items.
      await page.waitForFunction(
        (expected) => document.querySelectorAll('[data-item-id]').length === expected,
        3,
        { timeout: 15_000 },
      )
      assert.equal(await page.locator('[data-item-id]').count(), 3)
      assert.equal(
        await targetItemCount(targetId),
        3,
        'the source items must be appended exactly once',
      )
    } finally {
      await pool.query('DELETE FROM lists WHERE id = $1', [sourceId])
      await pool.query('DELETE FROM lists WHERE id = $1', [targetId])
    }
  })

  it('merges the open list even while it has pending unsaved edits', async (t) => {
    let { sourceId, targetId } = await seedLists()
    try {
      let server = await createTestServer((request) => router.fetch(request))
      let page = await t.serve(server)
      await page
        .context()
        .addCookies([{ name: 'session', value: adminCookie.slice(8), url: server.baseUrl }])

      // Load the SOURCE list, so the drag source is also the open (loaded) list.
      await page.goto(`/lists?load=${sourceId}`)
      await page.locator('#lists-title').waitFor({ timeout: 15_000 })
      await page.locator(`[data-list-id="${targetId}"]`).waitFor({ timeout: 15_000 })
      await installConfirm(page, true)

      // Every attempt dirties the open list and drags in one synchronous task, so
      // the 1500ms autosave can never win the race: the drop handler's flushNow()
      // is what saves, and that save bumps the source's updated_at. The merge's
      // If-Match must therefore be resolved *after* the flush — reading the
      // pre-flush sidebar snapshot makes the server answer 409 and no items move.
      await dragUntilPrompted(page, sourceId, targetId, {
        dirtyTitle: 'Quelle mit ungespeicherten Änderungen',
      })

      // The frame reloads onto the SOURCE list, so assert on the target's row:
      // one seeded target item plus both seeded source items, exactly once.
      let targetItems = await targetItemCount(targetId)
      for (let attempt = 0; attempt < 40 && targetItems !== 3; attempt++) {
        await page.waitForTimeout(250)
        targetItems = await targetItemCount(targetId)
      }
      assert.equal(targetItems, 3, 'a merge from a dirty open list must still append its items')
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
      await installConfirm(page, false)

      // The returned count proves the drop handler actually ran — a drag sent
      // before the client entry hydrates would otherwise be a no-op and the
      // "nothing changed" assertions below would pass vacuously.
      let calls = await dragUntilPrompted(page, sourceId, targetId)
      assert.equal(calls, 1, 'the confirmation must be asked exactly once')

      // Nothing may have been written, in the rendered editor or in the database.
      await page.waitForTimeout(500)
      assert.equal(await page.locator('[data-item-id]').count(), 1)
      assert.equal(
        await targetItemCount(targetId),
        1,
        'a declined confirmation must not merge',
      )
    } finally {
      await pool.query('DELETE FROM lists WHERE id = $1', [sourceId])
      await pool.query('DELETE FROM lists WHERE id = $1', [targetId])
    }
  })
})
