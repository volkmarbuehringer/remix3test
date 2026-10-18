import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../test-router.ts'
import { initializeAppDatabase } from '../../db.ts'
import { pool } from '../../../test/pool.ts'
import { createAuthCookieWithCsrfForUser } from '../../../test/utils.ts'

// ---------------------------------------------------------------------------
// Sidebar row action menu (real server-rendered markup + geometry).
//
// The browser suite covers dismissal/focus against a fixture. This e2e proves
// the production sidebar actually renders one visible trigger per row, keeps
// the name and count badge visible, hides the closed menu (so its actions are
// not tabbable), and stays overflow-free at phone and desktop widths.
// ---------------------------------------------------------------------------

type RowMetrics = {
  id: string | null
  height: number
  trigger: { width: number; height: number } | null
  nameText: string
  nameWidth: number
  countVisible: boolean
  menuVisible: boolean
  menuButtons: Array<{ text: string; draggable: string | null }>
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
        let triggerRect = trigger?.getBoundingClientRect()
        let nameRect = name?.getBoundingClientRect()
        let countRect = count?.getBoundingClientRect()
        return {
          id: row.dataset.listId ?? null,
          height: row.getBoundingClientRect().height,
          trigger: triggerRect ? { width: triggerRect.width, height: triggerRect.height } : null,
          nameText: name?.textContent?.trim() ?? '',
          nameWidth: nameRect?.width ?? 0,
          countVisible:
            countRect !== undefined &&
            countRect.width > 0 &&
            count !== null &&
            getComputedStyle(count).opacity !== '0',
          menuVisible: menu !== null && menu.offsetParent !== null,
          menuButtons: menu
            ? Array.from(menu.querySelectorAll<HTMLElement>('button')).map((button) => ({
                text: button.textContent?.trim() ?? '',
                draggable: button.getAttribute('draggable'),
              }))
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
// a silent no-op. Click until the drawer opens, like the drag suite does.
async function openSidebar(page: {
  locator: Function
  evaluate: Function
  waitForTimeout: Function
}) {
  let toggle = page.locator('#sidebar-shell-toggle')
  for (let attempt = 0; attempt < 60; attempt++) {
    let open = (await page.evaluate(
      () => document.getElementById('sidebar-shell-nav')?.classList.contains('is-open') ?? false,
    )) as boolean
    if (open) return
    await toggle.click()
    await page.waitForTimeout(100)
  }
  throw new Error('the phone sidebar drawer did not open')
}

function assertSidebarGeometry(metrics: PageMetrics) {
  assert.ok(
    metrics.scrollWidth <= metrics.innerWidth + 1,
    `sidebar must not overflow horizontally (${metrics.scrollWidth} > ${metrics.innerWidth})`,
  )
  assert.ok(metrics.rows.length > 0, 'sidebar must render saved list rows')

  for (let row of metrics.rows) {
    assert.ok(row.trigger, `row ${row.id} must render one action trigger`)
    assert.ok(
      row.trigger!.width >= 44 && row.trigger!.height >= 44,
      `row ${row.id} trigger must be at least 44x44 (got ${row.trigger!.width}x${row.trigger!.height})`,
    )
    // Only long names can prove the trigger is not squeezing the label; a
    // legitimately short name ("A") is narrow even without a trigger.
    if (row.nameText.length >= 20) {
      assert.ok(
        row.nameWidth >= 60,
        `row ${row.id} long name must stay readable (got ${row.nameWidth}px)`,
      )
    }
    assert.equal(row.countVisible, true, `row ${row.id} count badge must stay visible`)
    assert.equal(row.menuVisible, false, `row ${row.id} menu must start closed`)
    assert.equal(row.menuButtons.length, 3, `row ${row.id} menu must offer three actions`)
    assert.equal(
      row.menuButtons.every((button) => button.draggable === 'false'),
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

  it('keeps one visible trigger per row at desktop width and restores focus', async (t) => {
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

      assertSidebarGeometry(await readMetrics(page))

      let trigger = page.locator(`[data-list-id="${openId}"] [data-list-menu-button]`)
      await trigger.click()
      await page.waitForFunction(
        (id) =>
          document
            .querySelector(`[data-list-id="${id}"] [data-list-menu]`)
            ?.hasAttribute('data-list-menu-open') === true,
        openId,
        { timeout: 5_000 },
      )

      assert.equal(await trigger.getAttribute('aria-expanded'), 'true')
      assert.equal(
        await page.evaluate(() => document.activeElement?.textContent?.trim()),
        'Umbenennen',
        'opening the menu must focus its first action',
      )
      let openMetrics = await readMetrics(page)
      let openRow = openMetrics.rows.find((row) => row.id === String(openId))
      assert.ok(openRow?.menuVisible, 'the open menu must be rendered inline')
      assert.equal(
        openRow?.countVisible,
        true,
        'the count badge must stay visible while the menu is open',
      )

      await page.keyboard.press('Escape')
      await page.waitForFunction(
        (id) =>
          document
            .querySelector(`[data-list-id="${id}"] [data-list-menu]`)
            ?.hasAttribute('data-list-menu-open') === false,
        openId,
        { timeout: 5_000 },
      )
      assert.equal(await trigger.getAttribute('aria-expanded'), 'false')
      assert.equal(
        await page.evaluate(() => document.activeElement?.getAttribute('data-list-menu-button')),
        '',
        'Escape must return focus to the trigger',
      )

      // Re-open, then dismiss with an outside pointer down.
      await trigger.click()
      await page.locator('#lists-title').click()
      await page.waitForFunction(
        (id) =>
          document
            .querySelector(`[data-list-id="${id}"] [data-list-menu]`)
            ?.hasAttribute('data-list-menu-open') === false,
        openId,
        { timeout: 5_000 },
      )

      // Rename starts the inline name editor (outside the menu), and closing the
      // menu must not steal focus from the freshly inserted input.
      await trigger.click()
      await page
        .locator(`[data-list-id="${openId}"] [data-list-menu] button`)
        .filter({ hasText: 'Umbenennen' })
        .click()
      let renameInput = page.locator(`[data-list-id="${openId}"] input[type="text"]`)
      await renameInput.waitFor({ timeout: 5_000 })
      assert.equal(await renameInput.inputValue(), 'Sidebar menu open list')
      assert.equal(
        await page.evaluate(() => document.activeElement?.tagName),
        'INPUT',
        'the rename action must focus the inline name editor',
      )
      await page.keyboard.press('Escape')
      await page.waitForFunction(
        (id) => document.querySelector(`[data-list-id="${id}"] input[type="text"]`) === null,
        openId,
        { timeout: 5_000 },
      )

      // Delete must open the shared styled confirm dialog. The menu closes in
      // capture phase before ConfirmDelete's handler, so this proves hiding the
      // menu does not swallow the form's submit interception.
      await trigger.click()
      await page
        .locator(`[data-list-id="${openId}"] [data-list-menu] button`)
        .filter({ hasText: 'Löschen' })
        .click()
      await page.locator('[data-confirm-dialog]').waitFor({ timeout: 5_000 })
      assert.ok(
        (await page.locator('[data-confirm-dialog]').innerText()).includes('Löschen bestätigen'),
        'the delete action must open the styled confirmation dialog',
      )
      await page.locator('[data-confirm-cancel]').click()
      await page.locator('[data-confirm-dialog]').waitFor({ state: 'detached', timeout: 5_000 })

      // Duplicate submits the menu's form; the frame navigates to the copy and
      // the sidebar grows by one row.
      let beforeRows = await page.locator('[data-list-id]').count()
      await trigger.click()
      await page
        .locator(`[data-list-id="${openId}"] [data-list-menu] button`)
        .filter({ hasText: 'Duplizieren' })
        .click()
      await page.waitForFunction(
        (count) => document.querySelectorAll('[data-list-id]').length > count,
        beforeRows,
        { timeout: 15_000 },
      )
      let copyRows = (
        await pool.query('SELECT id FROM lists WHERE title = $1', [
          'Sidebar menu open list (Kopie)',
        ])
      ).rows as { id: number }[]
      for (let row of copyRows) copiedIds.push(Number(row.id))
      assert.equal(copyRows.length, 1, 'the duplicate must be persisted exactly once')
      await page
        .locator(`[data-list-id="${copiedIds[0]}"]`)
        .waitFor({ state: 'attached', timeout: 15_000 })
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
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto(`/lists?load=${openId}`)
      await waitForSidebar(page)

      // The phone layout hides the sidebar panel behind the "Listen" toggle.
      await openSidebar(page)

      assertSidebarGeometry(await readMetrics(page))

      let trigger = page.locator(`[data-list-id="${openId}"] [data-list-menu-button]`)
      await trigger.click()
      await page.waitForFunction(
        (id) =>
          document
            .querySelector(`[data-list-id="${id}"] [data-list-menu]`)
            ?.hasAttribute('data-list-menu-open') === true,
        openId,
        { timeout: 5_000 },
      )
      assert.equal(
        await page.evaluate(() => document.activeElement?.textContent?.trim()),
        'Umbenennen',
        'the phone menu must focus its first action',
      )

      await page.keyboard.press('Escape')
      assert.equal(
        await page.evaluate(() => document.activeElement?.getAttribute('data-list-menu-button')),
        '',
        'Escape must return focus to the phone trigger',
      )
    } finally {
      await removeLists()
    }
  })
})
