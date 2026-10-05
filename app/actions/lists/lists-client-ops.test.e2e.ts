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
// The drag-based, server-dependent list operations: merging via sidebar drag,
// copying selected items into another list, and cross-list item moves — each
// asserting the DB round trip after the gesture. The static toolbar/label
// layout guards (sort control, clear-completed + duplicate rendering, the
// collapsed-label regression, the two-line clamp, the two checkbox columns’
// size/colour distinction, and their tooltips) need no server or frame and
// moved to lists-editor-layout.test.browser.tsx.
//
// Note: we deliberately avoid clicking the hover-reveal action-cluster buttons
// here — Firefox + Playwright synthetic pointer events are unreliable for them
// and make such interactions flaky across browsers.
// ---------------------------------------------------------------------------

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
    return (await page.evaluate(() =>
      Number(document.documentElement.dataset.confirmCalls ?? '0'),
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
      assert.equal(await targetItemCount(targetId), 1, 'a declined confirmation must not merge')
    } finally {
      await pool.query('DELETE FROM lists WHERE id = $1', [sourceId])
      await pool.query('DELETE FROM lists WHERE id = $1', [targetId])
    }
  })
})

// ---------------------------------------------------------------------------
// /lists copy selected items into another list (client entry e2e).
//
// Exercises the row selection checkboxes + the bulk "In Liste kopieren" bar:
// select two of three source items, pick the target list in the picker, copy.
// The server appends only the selected items with fresh ids and leaves the
// source untouched. Selection lives in the client entry, so the driver retries
// until the bulk count registers — a pre-hydration toggle is a silent no-op.
// ---------------------------------------------------------------------------

describe('lists copy selected items into another list', () => {
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

  async function seedLists() {
    let now = Date.now()
    let sourceItems = JSON.stringify([
      { id: 'copy-src-1', label: 'Quell Eintrag 1' },
      { id: 'copy-src-2', label: 'Quell Eintrag 2' },
      { id: 'copy-src-3', label: 'Quell Eintrag 3' },
    ])
    let targetItems = JSON.stringify([{ id: 'copy-tgt-1', label: 'Ziel Eintrag' }])

    let sourceResult = await pool.query(
      'INSERT INTO lists (user_id, title, description, list, created_at, updated_at) VALUES ($1, $2, $3, $4::jsonb, $5, $5) RETURNING id',
      [adminUserId, 'copy source', 'seeded source for copy e2e', sourceItems, now],
    )
    let sourceId = Number(sourceResult.rows[0]!.id as number)

    let targetResult = await pool.query(
      'INSERT INTO lists (user_id, title, description, list, created_at, updated_at) VALUES ($1, $2, $3, $4::jsonb, $5, $5) RETURNING id',
      [adminUserId, 'copy target', 'seeded target for copy e2e', targetItems, now],
    )
    let targetId = Number(targetResult.rows[0]!.id as number)

    return { sourceId, targetId }
  }

  async function listItems(listId: number) {
    let row = await pool.query('SELECT list FROM lists WHERE id = $1', [listId])
    return row.rows[0]!.list as Array<{ id: string; label: string }>
  }

  // Drive the selection checkboxes until the rendered bulk count matches. Each
  // attempt first clears any stale native checkbox state, then checks the wanted
  // ids; before hydration the dispatches are no-ops, so the loop retries.
  async function selectItems(
    page: { evaluate: Function; waitForTimeout: Function },
    ids: string[],
  ) {
    for (let attempt = 0; attempt < 60; attempt++) {
      await page.evaluate((wanted: string[]) => {
        for (let box of Array.from(
          document.querySelectorAll<HTMLInputElement>('[data-select-item]'),
        )) {
          if (box.checked) {
            box.checked = false
            box.dispatchEvent(new Event('change', { bubbles: true }))
          }
        }
        for (let id of wanted) {
          let box = document.querySelector<HTMLInputElement>(`[data-select-item="${id}"]`)
          if (box && !box.checked) {
            box.checked = true
            box.dispatchEvent(new Event('change', { bubbles: true }))
          }
        }
      }, ids)

      let count = (await page.evaluate(
        () => document.querySelector('[data-bulk-count]')?.getAttribute('data-bulk-count') ?? '0',
      )) as string
      if (Number(count) === ids.length) return
      await page.waitForTimeout(250)
    }
    assert.ok(false, 'the selection must register once the client entry hydrates')
  }

  it('copies only the selected items into the target and leaves the source intact', async (t) => {
    let { sourceId, targetId } = await seedLists()
    try {
      let server = await createTestServer((request) => router.fetch(request))
      let page = await t.serve(server)
      await page
        .context()
        .addCookies([{ name: 'session', value: adminCookie.slice(8), url: server.baseUrl }])

      await page.goto(`/lists?load=${sourceId}`)
      await page.locator('#lists-title').waitFor({ timeout: 15_000 })
      await page.locator(`[data-list-id="${targetId}"]`).waitFor({ timeout: 15_000 })

      // Select the first and third source items (skip the middle one).
      await selectItems(page, ['copy-src-1', 'copy-src-3'])

      // The picker must offer the other sidebar list as a target.
      assert.equal(
        await page.locator(`#copy-items-target option[value="${targetId}"]`).count(),
        1,
        'the target picker should list the other sidebar list',
      )

      await page.selectOption('#copy-items-target', String(targetId))
      await page.locator('button:has-text("In Liste kopieren")').click()

      // The server appends the two selected copies to the target.
      let targetItems = await listItems(targetId)
      for (let attempt = 0; attempt < 40 && targetItems.length !== 3; attempt++) {
        await page.waitForTimeout(250)
        targetItems = await listItems(targetId)
      }
      assert.equal(targetItems.length, 3, 'exactly the two selected items must be appended')
      assert.equal(targetItems[0]!.label, 'Ziel Eintrag', 'existing target item stays first')
      assert.equal(targetItems[1]!.label, 'Quell Eintrag 1')
      assert.equal(targetItems[2]!.label, 'Quell Eintrag 3')
      assert.ok(
        !targetItems.some((item) => item.id === 'copy-src-1' || item.id === 'copy-src-3'),
        'copied items must receive fresh ids',
      )

      // The skipped item stays in the source, and the source is untouched.
      let sourceItems = await listItems(sourceId)
      assert.deepEqual(
        sourceItems.map((item) => item.id),
        ['copy-src-1', 'copy-src-2', 'copy-src-3'],
        'source item ids must be unchanged',
      )
    } finally {
      await pool.query('DELETE FROM lists WHERE id = $1', [sourceId])
      await pool.query('DELETE FROM lists WHERE id = $1', [targetId])
    }
  })

  it('deletes only the selected items from the open list via the overflow menu', async (t) => {
    let { sourceId, targetId } = await seedLists()
    try {
      let server = await createTestServer((request) => router.fetch(request))
      let page = await t.serve(server)
      await page
        .context()
        .addCookies([{ name: 'session', value: adminCookie.slice(8), url: server.baseUrl }])

      await page.goto(`/lists?load=${sourceId}`)
      await page.locator('#lists-title').waitFor({ timeout: 15_000 })

      // Select the first and third source items (skip the middle one).
      await selectItems(page, ['copy-src-1', 'copy-src-3'])

      // The destructive bulk action lives in the "⋯ Weitere Aktionen" overflow
      // menu and is only enabled while at least one row is selected.
      await page.locator('summary[aria-label="Weitere Aktionen"]').click()
      let deleteSelectedBtn = page.locator('button:has-text("Auswahl löschen")')
      assert.equal(await deleteSelectedBtn.count(), 1)
      assert.ok(
        await deleteSelectedBtn.isEnabled(),
        'delete-selected must be enabled once rows are selected',
      )
      await deleteSelectedBtn.click()
      assert.equal(
        await page.locator('details[data-lists-more][open]').count(),
        0,
        'choosing an action must dismiss the menu',
      )

      // The editor drops the two selected rows and keeps the unselected one.
      await page.waitForFunction(
        () => document.querySelectorAll('[data-item-id]').length === 1,
        undefined,
        { timeout: 15_000 },
      )
      assert.equal(await page.locator('[data-item-id="copy-src-2"]').count(), 1)

      // The debounced autosave persists the deletion.
      let sourceItems = await listItems(sourceId)
      for (let attempt = 0; attempt < 40 && sourceItems.length !== 1; attempt++) {
        await page.waitForTimeout(250)
        sourceItems = await listItems(sourceId)
      }
      assert.deepEqual(
        sourceItems.map((item) => item.id),
        ['copy-src-2'],
        'only the unselected item must survive',
      )
    } finally {
      await pool.query('DELETE FROM lists WHERE id = $1', [sourceId])
      await pool.query('DELETE FROM lists WHERE id = $1', [targetId])
    }
  })
})

// ---------------------------------------------------------------------------
// /lists cross-list move via item drag (client entry e2e).
//
// Dragging the last remaining item of a list onto another list's sidebar row
// must move it and leave the source list empty: an empty list is a valid state
// (the editor and PUT /lists/:id both allow clearing every item). Uses
// synthetic DragEvents plus the client-only bulk-bar hydration marker, like the
// copy-selected tests.
// ---------------------------------------------------------------------------

describe('lists cross-list move via item drag', () => {
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

  async function seedLists() {
    let now = Date.now()
    let sourceItems = JSON.stringify([{ id: 'move-src-1', label: 'Letzter Eintrag' }])
    let targetItems = JSON.stringify([{ id: 'move-tgt-1', label: 'Ziel Eintrag' }])

    let sourceResult = await pool.query(
      'INSERT INTO lists (user_id, title, description, list, created_at, updated_at) VALUES ($1, $2, $3, $4::jsonb, $5, $5) RETURNING id',
      [adminUserId, 'move source', 'seeded source for move drag e2e', sourceItems, now],
    )
    let targetResult = await pool.query(
      'INSERT INTO lists (user_id, title, description, list, created_at, updated_at) VALUES ($1, $2, $3, $4::jsonb, $5, $5) RETURNING id',
      [adminUserId, 'move target', 'seeded target for move drag e2e', targetItems, now],
    )

    return {
      sourceId: Number(sourceResult.rows[0]!.id as number),
      targetId: Number(targetResult.rows[0]!.id as number),
    }
  }

  async function listItems(listId: number) {
    let row = await pool.query('SELECT list FROM lists WHERE id = $1', [listId])
    return row.rows[0]!.list as Array<{ id: string; label: string }>
  }

  function dragItemOntoList(page: { evaluate: Function }, itemId: string, targetListId: number) {
    return page.evaluate(
      ({ itemSel, targetSel }: { itemSel: string; targetSel: string }) => {
        let source = document.querySelector(itemSel) as HTMLElement | null
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
      { itemSel: `[data-item-id="${itemId}"]`, targetSel: `[data-list-id="${targetListId}"]` },
    )
  }

  it('moves the last item out and leaves the source list empty', async (t) => {
    let { sourceId, targetId } = await seedLists()
    try {
      let server = await createTestServer((request) => router.fetch(request))
      let page = await t.serve(server)
      await page
        .context()
        .addCookies([{ name: 'session', value: adminCookie.slice(8), url: server.baseUrl }])

      await page.goto(`/lists?load=${sourceId}`)
      await page.locator('#lists-title').waitFor({ timeout: 15_000 })
      await page.locator('[data-item-id="move-src-1"]').waitFor({ timeout: 15_000 })
      await page.locator(`[data-list-id="${targetId}"]`).waitFor({ timeout: 15_000 })

      // Hydration marker: the row-selection bulk bar is client-only, so a
      // synthetic drag before it appears would be a silent no-op.
      for (let attempt = 0; attempt < 60; attempt++) {
        await page.evaluate(() => {
          let box = document.querySelector<HTMLInputElement>('[data-select-item="move-src-1"]')
          if (box && !box.checked) {
            box.checked = true
            box.dispatchEvent(new Event('change', { bubbles: true }))
          }
        })
        if ((await page.locator('[data-bulk-count]').count()) > 0) break
        await page.waitForTimeout(250)
      }
      await page.evaluate(() => {
        let box = document.querySelector<HTMLInputElement>('[data-select-item="move-src-1"]')
        if (box && box.checked) {
          box.checked = false
          box.dispatchEvent(new Event('change', { bubbles: true }))
        }
      })

      await dragItemOntoList(page, 'move-src-1', targetId)

      let sourceItems = await listItems(sourceId)
      for (let attempt = 0; attempt < 40 && sourceItems.length !== 0; attempt++) {
        await page.waitForTimeout(250)
        sourceItems = await listItems(sourceId)
      }
      assert.equal(sourceItems.length, 0, 'moving the last item must leave the source empty')

      let targetItems = await listItems(targetId)
      assert.deepEqual(
        targetItems.map((item) => item.id),
        ['move-tgt-1', 'move-src-1'],
        'the moved item must be appended after the target items',
      )
    } finally {
      await pool.query('DELETE FROM lists WHERE id = $1', [sourceId])
      await pool.query('DELETE FROM lists WHERE id = $1', [targetId])
    }
  })
})
