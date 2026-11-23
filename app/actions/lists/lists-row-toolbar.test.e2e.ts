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
// Since the reorder runs in a same-document View Transition, the pointer test
// waits for the snapshot overlay to clear before reading the hover reveal.
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
    await page.locator('[data-lists-ready="true"]').waitFor({ state: 'attached', timeout: 15_000 })
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
      let kebab = row.locator('[data-item-menu-button]')
      let actions = row.locator('[data-item-actions]')
      let down = actions.locator('button[aria-label="Nach unten"]')

      // The hover reveal is server-rendered CSS, but the click handler attaches
      // with the deferred client entry; openList waited for its marker.
      // Merely crossing the row must not reveal the overlay; only reaching the
      // kebab (or the cluster beside it) does.
      await row.hover()
      assert.equal(
        await actions.evaluate((el) => getComputedStyle(el).opacity),
        '0',
        'row hover must not reveal the item action cluster',
      )
      await kebab.hover()
      await page.waitForFunction(
        () => {
          let group = document.querySelector(
            '[data-item-id="move-b"] [data-item-actions]',
          ) as HTMLElement | null
          return group ? getComputedStyle(group).opacity === '1' : false
        },
        undefined,
        { timeout: 5_000 },
      )
      await down.hover()
      await down.click()
      await page.waitForFunction(
        (id: string) =>
          [...document.querySelectorAll<HTMLElement>('[data-item-id]')][2]?.dataset.itemId === id,
        'move-b',
        { timeout: 15_000 },
      )

      // The reorder runs inside a same-document View Transition. Wait for the
      // moved row and its restored action focus rather than assuming a fixed
      // post-transition frame.
      await page.waitForFunction(
        () => {
          let rows = [...document.querySelectorAll<HTMLElement>('[data-item-id]')]
          let active = document.activeElement
          let activeRow = active?.closest<HTMLElement>('[data-item-id]')
          return (
            rows[2]?.dataset.itemId === 'move-b' &&
            activeRow?.dataset.itemId === 'move-b' &&
            active?.getAttribute('aria-label') === 'Nach unten'
          )
        },
        undefined,
        { timeout: 5_000 },
      )

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
      assert.ok(
        state.visible.length <= 1,
        `row-hover must not leave multiple toolbars visible (got ${state.visible.join(', ')})`,
      )
      assert.ok(
        state.visible.every((id) => id === 'move-b'),
        `only the focused row may reveal its toolbar (got ${state.visible.join(', ')})`,
      )
      assert.equal(state.activeRow, 'move-b', 'focus must follow the moved row')
      assert.equal(state.activeLabel, 'Nach unten')

      // Explicitly hovering the moved row's kebab reveals exactly that row's
      // toolbar and no other.
      await page.locator('[data-item-id="move-b"] [data-item-menu-button]').hover()
      await page.waitForFunction(
        () => {
          let rows = [...document.querySelectorAll<HTMLElement>('[data-item-id]')]
          let visible = rows.flatMap((candidate) => {
            let cluster = candidate.querySelector<HTMLElement>('[data-item-actions]')
            if (!cluster) return []
            return Number(getComputedStyle(cluster).opacity) > 0.5 ? [candidate.dataset.itemId] : []
          })
          return visible.length === 1 && visible[0] === 'move-b'
        },
        undefined,
        { timeout: 5_000 },
      )
    } finally {
      await pool.query('DELETE FROM lists WHERE id = $1', [listId])
    }
  })

  it('pins the item action overlay from the kebab and keeps row hover passive', async (t) => {
    let listId = await seedList()
    try {
      let server = await createTestServer((request) => router.fetch(request))
      let page = await t.serve(server)
      await page
        .context()
        .addCookies([{ name: 'session', value: adminCookie.slice(8), url: server.baseUrl }])
      await openList(page, listId)

      let row = page.locator('[data-item-id="move-a"]')
      let kebab = row.locator('[data-item-menu-button]')
      let actions = row.locator('[data-item-actions]')
      let opacity = () => actions.evaluate((el) => getComputedStyle(el).opacity)

      await row.hover()
      assert.equal(await opacity(), '0', 'row hover must not reveal the item actions')

      await kebab.hover()
      await page.waitForFunction(
        () => {
          let group = document.querySelector(
            '[data-item-id="move-a"] [data-item-actions]',
          ) as HTMLElement | null
          return group ? getComputedStyle(group).opacity === '1' : false
        },
        undefined,
        { timeout: 5_000 },
      )
      assert.equal(await opacity(), '1', 'kebab hover must reveal the item actions')

      await kebab.click()
      assert.equal(await kebab.getAttribute('aria-expanded'), 'true')
      await page.mouse.move(1, 1)
      await page.waitForFunction(
        () => {
          let group = document.querySelector(
            '[data-item-id="move-a"] [data-item-actions]',
          ) as HTMLElement | null
          return group ? getComputedStyle(group).opacity === '1' : false
        },
        undefined,
        { timeout: 5_000 },
      )
      let desktopMenuDisplay = await row
        .locator('[data-item-menu="move-a"]')
        .evaluate((el) => getComputedStyle(el).display)
      assert.equal(
        desktopMenuDisplay,
        'none',
        'desktop must pin the floating overlay instead of the inline touch menu',
      )

      await page.keyboard.press('Escape')
      assert.equal(await kebab.getAttribute('aria-expanded'), 'false')
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
      await up.focus()
      await page.keyboard.press('Enter')
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll<HTMLElement>('[data-item-id]')][1]?.dataset.itemId ===
          'move-c',
        undefined,
        { timeout: 15_000 },
      )

      // The reorder runs in a View Transition; wait for focus and the moved
      // row's toolbar reveal instead of assuming a fixed post-transition frame.
      await page.waitForFunction(
        () => {
          let active = document.activeElement
          let activeRow = active?.closest<HTMLElement>('[data-item-id]')
          if (activeRow?.dataset.itemId !== 'move-c') return false
          let cluster = activeRow.querySelector<HTMLElement>('[data-item-actions]')
          return cluster !== null && Number(getComputedStyle(cluster).opacity) > 0.99
        },
        undefined,
        { timeout: 5_000 },
      )

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
