import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../test-router.ts'
import { initializeAppDatabase } from '../../db.ts'
import { pool } from '../../../test/pool.ts'
import { createAuthCookieWithCsrfForUser } from '../../../test/utils.ts'
import { MOBILE_VIEWPORT } from '../../../test/responsive.ts'

// ---------------------------------------------------------------------------
// Sidebar row actions (real server-rendered markup + geometry).
//
// The kebab trigger stays visible on every row. Desktop rows reveal an action
// overlay when the kebab is hovered or focused; touch and narrow browsers open
// the same actions as an inline menu. The browser suite covers dismissal/focus
// against the menu fixture; this e2e proves the production sidebar stays
// overflow-free and executes the real actions.
// ---------------------------------------------------------------------------

type ActionMetric = {
  draggable: string | null
  height: number
  label: string
  width: number
}

type RowMetrics = {
  id: string | null
  height: number
  rowWidth: number
  trigger: { width: number; height: number } | null
  triggerDisplay: string
  nameText: string
  nameWidth: number
  countVisible: boolean
  menuDisplay: string
  menuOpacity: string
  menuPointerEvents: string
  menuRightGap: number
  menuWidth: number
  actions: ActionMetric[]
}

type PageMetrics = {
  innerWidth: number
  scrollWidth: number
  rows: RowMetrics[]
}

async function readMetrics(page: { evaluate: Function }): Promise<PageMetrics> {
  return (await page.evaluate(() => {
    let rows = Array.from(document.querySelectorAll<HTMLElement>('[data-list-id]'))
    return {
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      rows: rows.map((row) => {
        let trigger = row.querySelector<HTMLElement>('[data-list-menu-button]')
        let name = row.querySelector<HTMLElement>('[data-list-name]')
        let count = row.querySelector<HTMLElement>('[data-list-count]')
        let menu = row.querySelector<HTMLElement>('[data-list-menu]')
        let rowRect = row.getBoundingClientRect()
        let triggerRect = trigger?.getBoundingClientRect()
        let nameRect = name?.getBoundingClientRect()
        let countRect = count?.getBoundingClientRect()
        let menuRect = menu?.getBoundingClientRect()
        let menuStyle = menu ? getComputedStyle(menu) : null
        return {
          id: row.dataset.listId ?? null,
          height: rowRect.height,
          rowWidth: rowRect.width,
          trigger: triggerRect ? { width: triggerRect.width, height: triggerRect.height } : null,
          triggerDisplay: trigger ? getComputedStyle(trigger).display : 'missing',
          nameText: name?.textContent?.trim() ?? '',
          nameWidth: nameRect?.width ?? 0,
          countVisible:
            countRect !== undefined &&
            countRect.width > 0 &&
            count !== null &&
            getComputedStyle(count).opacity !== '0',
          menuDisplay: menuStyle?.display ?? 'missing',
          menuOpacity: menuStyle?.opacity ?? 'missing',
          menuPointerEvents: menuStyle?.pointerEvents ?? 'missing',
          menuRightGap: menuRect ? rowRect.right - menuRect.right : Number.POSITIVE_INFINITY,
          menuWidth: menuRect?.width ?? 0,
          actions: menu
            ? Array.from(
                menu.querySelectorAll<HTMLElement>(
                  '[data-list-rename-btn], [data-list-copy-here-btn], [data-list-copy-btn], [data-list-pdf], [data-list-delete-btn]',
                ),
              ).map((action) => {
                let rect = action.getBoundingClientRect()
                return {
                  draggable: action.getAttribute('draggable'),
                  height: rect.height,
                  label: action.getAttribute('aria-label') ?? action.textContent?.trim() ?? '',
                  width: rect.width,
                }
              })
            : [],
        }
      }),
    }
  })) as PageMetrics
}

async function waitForSidebar(page: { locator: Function }) {
  await page.locator('#lists-title').waitFor({ timeout: 15_000 })
  // The phone sidebar is display: none until its toggle opens it, so the rows
  // are attached but not visible yet.
  await page.locator('[data-list-id]').first().waitFor({ state: 'attached', timeout: 15_000 })
}

// The drawer toggle is a deferred client entry: a click before it hydrates is
// a silent no-op. Wait for its client-only marker, then click once and wait for
// the drawer class it toggles.
async function openSidebar(page: { locator: Function; waitForFunction: Function }) {
  await page
    .locator('#sidebar-shell-toggle[data-sidebar-toggle-ready="true"]')
    .waitFor({ state: 'attached', timeout: 15_000 })
  await page.locator('#sidebar-shell-toggle').click()
  await page.waitForFunction(
    () => document.getElementById('sidebar-shell-nav')?.classList.contains('is-open') === true,
    undefined,
    { timeout: 5_000 },
  )
}

function isMenuOpen(id: number) {
  return (
    document
      .querySelector(`[data-list-id="${id}"] [data-list-menu]`)
      ?.hasAttribute('data-list-menu-open') === true
  )
}

// The touch fallback trigger is server-rendered, but its click handler attaches
// with the deferred ListsRowActions entry. Wait for the entry's readiness marker,
// then click once and wait for the open attribute it sets.
async function openListMenu(page: { locator: Function; waitForFunction: Function }, id: number) {
  await page
    .locator('[data-lists-row-actions-ready="true"]')
    .waitFor({ state: 'attached', timeout: 15_000 })
  let trigger = page.locator(`[data-list-id="${id}"] [data-list-menu-button]`)
  await trigger.click()
  await page.waitForFunction(isMenuOpen, id, { timeout: 5_000 })
  return trigger
}

/** Hover a desktop row's kebab and wait for the CSS-only overlay reveal to settle. */
async function revealOverlay(page: { locator: Function; waitForFunction: Function }, id: number) {
  await page.locator(`[data-list-id="${id}"] [data-list-menu-button]`).hover()
  await page.waitForFunction(
    (rowId: number) => {
      let row = document.querySelector(`[data-list-id="${rowId}"]`)
      let menu = row?.querySelector<HTMLElement>('[data-list-menu]')
      let count = row?.querySelector<HTMLElement>('[data-list-count]')
      if (!menu || !count) return false
      let menuStyle = getComputedStyle(menu)
      return (
        menuStyle.opacity === '1' &&
        menuStyle.pointerEvents === 'auto' &&
        getComputedStyle(count).opacity === '0'
      )
    },
    id,
    { timeout: 5_000 },
  )
}

function assertNoHorizontalOverflow(metrics: PageMetrics) {
  assert.ok(
    metrics.scrollWidth <= metrics.innerWidth + 1,
    `sidebar must not overflow horizontally (${metrics.scrollWidth} > ${metrics.innerWidth})`,
  )
  assert.ok(metrics.rows.length > 0, 'sidebar must render saved list rows')
}

function assertDesktopOverlayGeometry(metrics: PageMetrics) {
  assertNoHorizontalOverflow(metrics)

  for (let row of metrics.rows) {
    assert.notEqual(row.triggerDisplay, 'none', `row ${row.id} must keep the kebab visible`)
    assert.ok(
      row.trigger && row.trigger.width >= 44 && row.trigger.height >= 44,
      `row ${row.id} kebab must stay 44x44 (got ${row.trigger?.width}x${row.trigger?.height})`,
    )
    assert.notEqual(row.menuDisplay, 'none', `row ${row.id} must keep the overlay in layout`)
    assert.equal(row.menuOpacity, '0', `row ${row.id} overlay must start hidden`)
    assert.equal(
      row.menuPointerEvents,
      'none',
      `row ${row.id} hidden overlay must not receive pointer events`,
    )
    assert.ok(row.menuWidth > 0, `row ${row.id} overlay needs a visible action-group width`)
    assert.ok(
      row.menuRightGap >= 43 && row.menuRightGap <= 46,
      `row ${row.id} overlay must sit just left of the 44px kebab, got ${row.menuRightGap}px gap`,
    )
    assert.ok(
      row.menuWidth + row.menuRightGap <= row.rowWidth + 1,
      `row ${row.id} overlay must not spill out of the row box`,
    )
    assert.equal(row.countVisible, true, `row ${row.id} count badge must stay visible at rest`)
    assert.equal(row.actions.length, 5, `row ${row.id} overlay must offer five actions`)
    assert.equal(
      row.actions.every((action) => action.draggable === 'false'),
      true,
      `row ${row.id} overlay actions must not start a row drag`,
    )
    if (row.nameText.length >= 20) {
      assert.ok(
        row.nameWidth >= 60,
        `row ${row.id} long name must stay readable at rest (got ${row.nameWidth}px)`,
      )
    }
    assert.ok(
      row.height >= 40 && row.height <= 72,
      `row ${row.id} height must stay dense (got ${row.height}px)`,
    )
  }
}

function assertPhoneMenuGeometry(metrics: PageMetrics) {
  assertNoHorizontalOverflow(metrics)

  for (let row of metrics.rows) {
    assert.notEqual(row.triggerDisplay, 'none', `row ${row.id} must show the touch kebab`)
    assert.ok(
      row.trigger && row.trigger.width >= 44 && row.trigger.height >= 44,
      `row ${row.id} trigger must be at least 44x44 (got ${row.trigger?.width}x${row.trigger?.height})`,
    )
    assert.equal(row.menuDisplay, 'none', `row ${row.id} touch menu must start closed`)
    assert.equal(row.countVisible, true, `row ${row.id} count badge must stay visible`)
    assert.equal(row.actions.length, 5, `row ${row.id} menu must offer five actions`)
    assert.equal(
      row.actions.every((action) => action.draggable === 'false'),
      true,
      `row ${row.id} menu actions must not start a row drag`,
    )
    assert.ok(
      row.height >= 44 && row.height <= 72,
      `row ${row.id} height must stay dense (got ${row.height}px)`,
    )
  }
}

describe('lists sidebar row action menu', () => {
  let adminCookie: string
  let adminUserId: number
  let openId: number
  let otherId: number
  let copiedIds: number[] = []

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
    // Drop copies left by an earlier interrupted run so the duplicate action
    // assertion is not confused by stale rows with the same title.
    // Admins copy unowned lists (the copy keeps no user_id), so match by the
    // unique seeded title instead.
    await pool.query('DELETE FROM lists WHERE title = $1', ['Sidebar menu open list (Kopie)'])
    let now = Date.now()
    let openItems = JSON.stringify([
      { id: 'sidebar-open-1', label: 'Erledigter Eintrag', done: true },
      { id: 'sidebar-open-2', label: 'Offener Eintrag' },
    ])
    let otherItems = JSON.stringify([{ id: 'sidebar-other-1', label: 'Anderer Eintrag' }])

    let openResult = await pool.query(
      'INSERT INTO lists (user_id, title, description, list, created_at, updated_at) VALUES ($1, $2, $3, $4::jsonb, $5, $5) RETURNING id',
      [adminUserId, 'Sidebar menu open list', 'seeded for sidebar menu e2e', openItems, now],
    )
    let otherResult = await pool.query(
      'INSERT INTO lists (user_id, title, description, list, created_at, updated_at) VALUES ($1, $2, $3, $4::jsonb, $5, $5) RETURNING id',
      [adminUserId, 'Sidebar menu other list', 'seeded for sidebar menu e2e', otherItems, now - 1],
    )
    openId = Number(openResult.rows[0]!.id as number)
    otherId = Number(otherResult.rows[0]!.id as number)
  }

  async function removeLists() {
    for (let id of [...copiedIds, openId, otherId]) {
      if (id != null) await pool.query('DELETE FROM lists WHERE id = $1', [id])
    }
    copiedIds = []
  }

  it('reveals actions on hover beside the row kebab and runs them at desktop width', async (t) => {
    await seedLists()
    try {
      let server = await createTestServer((request) => router.fetch(request))
      let page = await t.serve(server)
      await page
        .context()
        .addCookies([{ name: 'session', value: adminCookie.slice(8), url: server.baseUrl }])
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto(`/lists?load=${openId}`)
      await waitForSidebar(page)

      assertDesktopOverlayGeometry(await readMetrics(page))

      // Touch-menu dismissal/focus is covered by
      // public/lists-row-actions.test.browser.tsx. This e2e keeps the production
      // wiring: the real overlay actions reach their mutation endpoints through
      // the frame, and the sidebar controls submit the GET form with the open
      // list preserved. Wait for the lists client before actions that rely on
      // delegated listeners (copy-here), then reveal the CSS-only overlay.
      await page.locator('[data-lists-ready="true"]').waitFor({ timeout: 15_000 })

      // Non-drag alternative to the list-to-list drag: copy the open list's
      // items into the clicked sidebar list through the shared confirm dialog.
      await revealOverlay(page, otherId)
      await page.locator(`[data-list-id="${otherId}"] [data-list-copy-here-btn]`).click()
      await page.locator('[data-confirm-dialog]').waitFor({ timeout: 5_000 })
      let copyDialogText = await page.locator('[data-confirm-dialog]').innerText()
      assert.ok(
        copyDialogText.includes('Elemente kopieren bestätigen'),
        'the copy-here action must use the styled confirmation dialog',
      )
      assert.ok(
        copyDialogText.includes('Sidebar menu open list') &&
          copyDialogText.includes('Sidebar menu other list'),
        'the confirmation must name both lists',
      )
      let copied = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname.endsWith('/merge'),
        { timeout: 15_000 },
      )
      await page.locator('[data-confirm-accept]').click()
      await page.locator('[data-confirm-dialog]').waitFor({ state: 'detached', timeout: 5_000 })
      await copied
      let row = await pool.query('SELECT list FROM lists WHERE id = $1', [otherId])
      assert.equal(
        (row.rows[0]!.list as unknown[]).length,
        3,
        'both open-list items must be copied into the target',
      )

      // Delete must open the shared styled confirm dialog.
      await revealOverlay(page, openId)
      await page.locator(`[data-list-id="${openId}"] [data-list-delete-btn]`).click()
      await page.locator('[data-confirm-dialog]').waitFor({ timeout: 5_000 })
      assert.ok(
        (await page.locator('[data-confirm-dialog]').innerText()).includes('Löschen bestätigen'),
        'the delete action must open the styled confirmation dialog',
      )
      await page.locator('[data-confirm-cancel]').click()
      await page.locator('[data-confirm-dialog]').waitFor({ state: 'detached', timeout: 5_000 })

      // Duplicate submits the overlay's form; the frame navigates to the copy
      // and the sidebar shows its row. Match the row by title instead of
      // asserting the row count grows: the sidebar is capped at 15 rows, so
      // with enough lists the new row replaces the last one and the count stays
      // the same. The lists client also owns the copy-here listener, so wait for
      // it again after the frame swap.
      await page.locator('[data-lists-ready="true"]').waitFor({ timeout: 15_000 })
      await revealOverlay(page, openId)
      await page.locator(`[data-list-id="${openId}"] [data-list-copy-btn]`).click()
      await page
        .locator('[data-list-id]', { hasText: 'Sidebar menu open list (Kopie)' })
        .waitFor({ state: 'attached', timeout: 15_000 })
      let copyRows = (
        await pool.query('SELECT id FROM lists WHERE title = $1', [
          'Sidebar menu open list (Kopie)',
        ])
      ).rows as { id: number }[]
      for (let copyRow of copyRows) copiedIds.push(Number(copyRow.id))
      assert.equal(copyRows.length, 1, 'the duplicate must be persisted exactly once')
      await page
        .locator(`[data-list-id="${copiedIds[0]}"]`)
        .waitFor({ state: 'attached', timeout: 15_000 })

      // Sidebar sort/page-size controls submit the shared GET form and keep the
      // open list in the URL. The client entry wires the change events; wait
      // for its marker instead of retrying a pre-hydration selectOption.
      let activeBeforeSort = await page.evaluate(
        () =>
          document.querySelector('[data-lists-active-id]')?.getAttribute('data-lists-active-id') ??
          '',
      )
      assert.ok(activeBeforeSort, 'a list should be open before sorting')
      await page
        .locator('[data-lists-search-ready="true"]')
        .waitFor({ state: 'attached', timeout: 15_000 })
      await page.selectOption('select[name="sort"]', 'name')
      await page.waitForFunction(() => location.search.includes('sort=name'), undefined, {
        timeout: 15_000,
      })
      assert.ok(
        (await page.evaluate(() => location.search)).includes('sort=name'),
        'changing the sort must navigate with sort=name',
      )
      assert.ok(
        (await page.evaluate(() => location.search)).includes(`load=${activeBeforeSort}`),
        'sorting must preserve the open list',
      )
      assert.equal(await page.locator('select[name="sort"]').inputValue(), 'name')

      await page
        .locator('[data-lists-search-ready="true"]')
        .waitFor({ state: 'attached', timeout: 15_000 })
      await page.selectOption('select[name="size"]', 'all')
      await page.waitForFunction(() => location.search.includes('size=all'), undefined, {
        timeout: 15_000,
      })
      assert.ok(
        (await page.evaluate(() => location.search)).includes('size=all'),
        'changing the page size must navigate with size=all',
      )
      assert.ok(
        await page.locator('[data-sidebar-result-count]').isVisible(),
        'the sidebar result count must stay visible',
      )
      assert.ok(
        /\d+ (Liste|Listen|Treffer)/.test(
          (await page.locator('[data-sidebar-result-count]').innerText()).trim(),
        ),
        'the result count must be human-readable',
      )
    } finally {
      await removeLists()
    }
  })

  it('keeps the phone sidebar overflow-free with 44px triggers', async (t) => {
    await seedLists()
    try {
      let server = await createTestServer((request) => router.fetch(request))
      let page = await t.serve(server)
      await page
        .context()
        .addCookies([{ name: 'session', value: adminCookie.slice(8), url: server.baseUrl }])
      await page.setViewportSize(MOBILE_VIEWPORT)
      await page.goto(`/lists?load=${openId}`)
      await waitForSidebar(page)

      // The phone layout hides the sidebar panel behind the "Listen" toggle.
      await openSidebar(page)

      assertPhoneMenuGeometry(await readMetrics(page))

      await openListMenu(page, openId)
      assert.equal(
        await page.evaluate(() => document.activeElement?.textContent?.trim()),
        'Umbenennen',
        'the phone menu must focus its first action',
      )

      await page.keyboard.press('Escape')
      assert.equal(
        await page.evaluate(() => document.activeElement?.hasAttribute('data-list-menu-button')),
        true,
        'Escape must return focus to the phone trigger',
      )
    } finally {
      await removeLists()
    }
  })
})
