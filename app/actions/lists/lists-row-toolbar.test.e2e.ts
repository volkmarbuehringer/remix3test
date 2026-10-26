import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../test-router.ts'
import { initializeAppDatabase } from '../../db.ts'
import { pool } from '../../../test/pool.ts'
import { createAuthCookieWithCsrfForUser } from '../../../test/utils.ts'

// ---------------------------------------------------------------------------
// Row action toolbar during ↑/↓ reorders.
//
// The toolbar is a hover/focus reveal. A pointer click on ↓ leaves the clicked
// row's DOM node in place (the keyed diff moves the following row instead), so
// focus used to stay inside the moved row and `:focus-within` kept its cluster
// open while the row that slid under the stationary cursor revealed its own —
// two toolbars at once. These tests drive the real pointer/keyboard paths and
// assert a single visible cluster; the CSS reveal itself lives in
// lists-view.tsx (`:hover`, `:focus-visible`, `:has(:focus-visible)`).
// ---------------------------------------------------------------------------

describe('lists row toolbar reordering', () => {
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

  async function seedList() {
    let now = Date.now()
    // Single-line labels keep every row the same height, so the stationary
    // pointer reliably lands on the row that replaces the clicked one.
    let items = JSON.stringify([
      { id: 'move-a', label: 'Alpha' },
      { id: 'move-b', label: 'Beta' },
      { id: 'move-c', label: 'Gamma' },
      { id: 'move-d', label: 'Delta' },
    ])
    let seeded = await pool.query(
      'INSERT INTO lists (user_id, title, description, list, created_at, updated_at) VALUES ($1, $2, $3, $4::jsonb, $5, $5) RETURNING id',
      [adminUserId, `Row toolbar ${now}`, 'seeded for the row toolbar e2e', items, now],
    )
    return Number(seeded.rows[0]!.id as number)
  }

  async function openList(page: { goto: Function; locator: Function }, listId: number) {
    await page.goto(`/lists?load=${listId}`)
    await page.locator('[data-item-id="move-a"]').waitFor({ timeout: 15_000 })
  }

  it('keeps one toolbar visible after a pointer moves a row down', async (t) => {
    let listId = await seedList()
    try {
      let server = await createTestServer((request) => router.fetch(request))
      let page = await t.serve(server)
      await page
        .context()
        .addCookies([{ name: 'session', value: adminCookie.slice(8), url: server.baseUrl }])
      await openList(page, listId)

      let row = page.locator('[data-item-id="move-b"]')
      let down = row.locator('[data-item-actions] button[aria-label="Nach unten"]')

      // The hover reveal is server-rendered CSS, but the click handler attaches
      // with the deferred client entry: retry through the hydration gap until
      // the row actually moves.
      let deadline = Date.now() + 15_000
      let moved = false
      while (Date.now() < deadline && !moved) {
        await row.hover()
        await down.hover()
        await down.click()
        try {
          await page.waitForFunction(
            (id: string) =>
              [...document.querySelectorAll<HTMLElement>('[data-item-id]')][2]?.dataset.itemId ===
              id,
            'move-b',
            { timeout: 800 },
          )
          moved = true
        } catch {
          // hydration gap — try again
        }
      }
      assert.ok(moved, 'the down button must reorder the row once hydrated')

      // The move + focus restore are queued; let them settle. No transition
      // remains on the cluster, so the hover swap is immediate.
      await page.waitForTimeout(250)

      let state = (await page.evaluate(() => {
        let rows = [...document.querySelectorAll<HTMLElement>('[data-item-id]')]
        let active = document.activeElement
        let activeRow = active?.closest<HTMLElement>('[data-item-id]')
        return {
          order: rows.map((r) => r.dataset.itemId),
          visible: rows.flatMap((r) => {
            let cluster = r.querySelector<HTMLElement>('[data-item-actions]')
            if (!cluster) return []
            let opacity = Number(getComputedStyle(cluster).opacity)
            return opacity > 0.5 ? [r.dataset.itemId] : []
          }),
          activeRow: activeRow?.dataset.itemId ?? null,
          activeLabel: active?.getAttribute('aria-label') ?? null,
        }
      })) as {
        order: Array<string | undefined>
        visible: Array<string | undefined>
        activeRow: string | null
        activeLabel: string | null
      }

      assert.deepEqual(state.order, ['move-a', 'move-c', 'move-b', 'move-d'])
      assert.deepEqual(
        state.visible,
        ['move-c'],
        'only the row under the stationary pointer may reveal its toolbar',
      )
      assert.equal(state.activeRow, 'move-b', 'focus must follow the moved row')
      assert.equal(state.activeLabel, 'Nach unten')
    } finally {
      await pool.query('DELETE FROM lists WHERE id = $1', [listId])
    }
  })

  it('keeps the moved row toolbar visible and focused after a keyboard move up', async (t) => {
    let listId = await seedList()
    try {
      let server = await createTestServer((request) => router.fetch(request))
      let page = await t.serve(server)
      await page
        .context()
        .addCookies([{ name: 'session', value: adminCookie.slice(8), url: server.baseUrl }])
      await openList(page, listId)

      // Move the pointer out of the editor: no hover may mask the focus path.
      await page.mouse.move(5, 5)
      // Keyboard modality so programmatic focus matches `:focus-visible`.
      await page.keyboard.press('Tab')

      let up = page.locator(
        '[data-item-id="move-c"] [data-item-actions] button[aria-label="Nach oben"]',
      )
      let deadline = Date.now() + 15_000
      let moved = false
      while (Date.now() < deadline && !moved) {
        await up.focus()
        await page.keyboard.press('Enter')
        try {
          await page.waitForFunction(
            () =>
              [...document.querySelectorAll<HTMLElement>('[data-item-id]')][1]?.dataset.itemId ===
              'move-c',
            undefined,
            { timeout: 800 },
          )
          moved = true
        } catch {
          // hydration gap — try again
        }
      }
      assert.ok(moved, 'the up button must reorder the row once hydrated')

      await page.waitForTimeout(250)

      let state = (await page.evaluate(() => {
        let rows = [...document.querySelectorAll<HTMLElement>('[data-item-id]')]
        let active = document.activeElement
        let activeRow = active?.closest<HTMLElement>('[data-item-id]')
        return {
          order: rows.map((r) => r.dataset.itemId),
          activeRow: activeRow?.dataset.itemId ?? null,
          activeLabel: active?.getAttribute('aria-label') ?? null,
          focusVisible: active?.matches(':focus-visible') ?? null,
          activeRowToolbar: Number(
            getComputedStyle(activeRow!.querySelector<HTMLElement>('[data-item-actions]')!).opacity,
          ),
        }
      })) as {
        order: Array<string | undefined>
        activeRow: string | null
        activeLabel: string | null
        focusVisible: boolean | null
        activeRowToolbar: number
      }

      assert.deepEqual(state.order, ['move-a', 'move-c', 'move-b', 'move-d'])
      assert.equal(state.activeRow, 'move-c', 'a reorder must not drop keyboard focus on <body>')
      assert.equal(state.activeLabel, 'Nach oben')
      assert.equal(state.focusVisible, true)
      assert.equal(state.activeRowToolbar, 1, 'keyboard focus keeps the moved row toolbar visible')
    } finally {
      await pool.query('DELETE FROM lists WHERE id = $1', [listId])
    }
  })
})
