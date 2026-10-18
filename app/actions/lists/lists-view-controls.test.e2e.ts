import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../test-router.ts'
import { initializeAppDatabase } from '../../db.ts'
import { pool } from '../../../test/pool.ts'
import { createAuthCookieWithCsrfForUser } from '../../../test/utils.ts'

// ---------------------------------------------------------------------------
// Status filter strip geometry (real SSR + CSS) at desktop and phone widths.
// Functional transitions live in public/lists-view-controls.test.browser.tsx.
// ---------------------------------------------------------------------------

function isoDate(offsetDays: number): string {
  let d = new Date()
  d.setDate(d.getDate() + offsetDays)
  let m = String(d.getMonth() + 1).padStart(2, '0')
  let day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

async function readGeometry(page: { evaluate: Function }) {
  return (await page.evaluate(() => {
    let bar = document.querySelector<HTMLElement>('[data-status-bar]')
    let tabs = Array.from(document.querySelectorAll<HTMLElement>('[data-status-filter]'))
    let hide = document.querySelector<HTMLElement>('[data-hide-done]')?.closest('label')
    return {
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      barScrollWidth: bar?.scrollWidth ?? 0,
      barClientWidth: bar?.clientWidth ?? 0,
      barHeight: bar?.getBoundingClientRect().height ?? 0,
      tabHeights: tabs.map((tab) => tab.getBoundingClientRect().height),
      hideHeight: hide?.getBoundingClientRect().height ?? 0,
    }
  })) as {
    innerWidth: number
    scrollWidth: number
    barScrollWidth: number
    barClientWidth: number
    barHeight: number
    tabHeights: number[]
    hideHeight: number
  }
}

async function waitForRows(page: { waitForFunction: Function }, expected: number, timeout = 500) {
  await page.waitForFunction(
    (count: number) => document.querySelectorAll('[data-item-id]').length === count,
    expected,
    { timeout },
  )
}

/**
 * Status buttons are server-rendered but their click handlers attach with the
 * deferred ListsClient entry. A click in the hydration gap is a silent no-op,
 * so retry until the expected row count lands (same hazard as the sort e2e).
 */
async function clickStatus(
  page: { locator: Function; waitForFunction: Function; waitForTimeout: Function },
  status: string,
  expected: number,
  timeout = 15_000,
) {
  let deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    try {
      await waitForRows(page, expected, 250)
      return
    } catch {
      // not there yet — click and retry
    }
    await page.locator(`[data-status-filter="${status}"]`).click()
    try {
      await waitForRows(page, expected, 500)
      return
    } catch {
      // hydration gap or another render still pending
    }
    await page.waitForTimeout(100)
  }
  throw new Error(`status "${status}" did not produce ${expected} rows`)
}

/**
 * The hide-done checkbox can toggle natively before hydration without running
 * its change handler. Ensure it is checked and re-dispatch `change` on every
 * attempt so the handler repairs the state once the entry is live.
 */
async function checkHideDone(
  page: { evaluate: Function; waitForFunction: Function; waitForTimeout: Function },
  expected: number,
  timeout = 15_000,
) {
  let deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    let state = (await page.evaluate(() => {
      let checkbox = document.querySelector<HTMLInputElement>('[data-hide-done]')
      return {
        checked: checkbox?.checked ?? false,
        rows: document.querySelectorAll('[data-item-id]').length,
      }
    })) as { checked: boolean; rows: number }
    if (state.checked && state.rows === expected) return

    await page.evaluate(() => {
      let checkbox = document.querySelector<HTMLInputElement>('[data-hide-done]')
      if (checkbox && !checkbox.checked) checkbox.click()
      checkbox?.dispatchEvent(new Event('change', { bubbles: true }))
    })

    try {
      await page.waitForFunction(
        (count: number) => {
          let checkbox = document.querySelector<HTMLInputElement>('[data-hide-done]')
          return (
            checkbox?.checked === true &&
            document.querySelectorAll('[data-item-id]').length === count
          )
        },
        expected,
        { timeout: 500 },
      )
      return
    } catch {
      // retry after hydration
    }
    await page.waitForTimeout(100)
  }
  throw new Error(`hide-done did not produce ${expected} rows`)
}

function assertGeometry(metrics: Awaited<ReturnType<typeof readGeometry>>) {
  assert.ok(
    metrics.scrollWidth <= metrics.innerWidth + 1,
    `the list page must not overflow horizontally (${metrics.scrollWidth} > ${metrics.innerWidth})`,
  )
  assert.ok(
    metrics.barScrollWidth <= metrics.barClientWidth + 1,
    `the status strip must not overflow internally (${metrics.barScrollWidth} > ${metrics.barClientWidth})`,
  )
  assert.ok(metrics.tabHeights.length >= 4, 'all four status tabs must render')
  for (let height of metrics.tabHeights) {
    assert.ok(height >= 44, `status tabs must meet the 44px touch target (got ${height})`)
  }
  assert.ok(
    metrics.hideHeight >= 44,
    `the hide-done label must meet the 44px touch target (got ${metrics.hideHeight})`,
  )
}

describe('lists status filter strip', () => {
  let adminCookie: string
  let adminUserId: number
  let listId: number

  before(async () => {
    await initializeAppDatabase()
    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')
    adminCookie = auth!.cookie
    let rows = (await pool.query('SELECT id FROM users WHERE email = $1', ['admin@newapp.com']))
      .rows as { id: number }[]
    assert.ok(rows.length > 0, 'admin user must exist')
    adminUserId = Number(rows[0]!.id)
  })

  async function seedList() {
    let now = Date.now()
    let items = JSON.stringify([
      { id: 'status-overdue', label: 'Überfällig offen', due: isoDate(-1) },
      { id: 'status-future', label: 'Zukunft offen', due: isoDate(5) },
      { id: 'status-done', label: 'Erledigt', done: true },
    ])
    let result = await pool.query(
      'INSERT INTO lists (user_id, title, description, list, created_at, updated_at) VALUES ($1, $2, $3, $4::jsonb, $5, $5) RETURNING id',
      [adminUserId, 'Status strip', 'seeded for status e2e', items, now],
    )
    listId = Number(result.rows[0]!.id as number)
  }

  it('filters by status and stays overflow-free at 1440 and 390', async (t) => {
    await seedList()
    try {
      let server = await createTestServer((request) => router.fetch(request))
      let page = await t.serve(server)
      await page
        .context()
        .addCookies([{ name: 'session', value: adminCookie.slice(8), url: server.baseUrl }])

      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto(`/lists?load=${listId}`)
      await page.locator('[data-status-bar]').waitFor({ timeout: 15_000 })
      await page.waitForFunction(
        () => document.querySelectorAll('[data-item-id]').length === 3,
        undefined,
        { timeout: 15_000 },
      )

      assert.equal(
        await page.locator('[data-status-filter="all"]').getAttribute('data-status-count'),
        '3',
      )
      assert.equal(
        await page.locator('[data-status-filter="open"]').getAttribute('data-status-count'),
        '2',
      )
      assert.equal(
        await page.locator('[data-status-filter="done"]').getAttribute('data-status-count'),
        '1',
      )
      assert.equal(
        await page.locator('[data-status-filter="overdue"]').getAttribute('data-status-count'),
        '1',
      )
      assertGeometry(await readGeometry(page))
      assert.notEqual(
        await page.evaluate(
          () =>
            getComputedStyle(document.querySelector('[data-help-button]') as HTMLElement).display,
        ),
        'none',
        'desktop keeps the ? toolbar control visible',
      )

      await clickStatus(page, 'open', 2)
      await clickStatus(page, 'overdue', 1)
      await clickStatus(page, 'all', 3)

      await checkHideDone(page, 2)
      assert.equal(
        await page.locator('[data-status-filter="all"]').getAttribute('data-status-count'),
        '2',
      )

      // Phone: the strip may wrap, but it must not overflow the page or itself.
      await page.setViewportSize({ width: 390, height: 844 })
      await page.reload()
      await page.locator('[data-status-bar]').waitFor({ timeout: 15_000 })
      await page.waitForFunction(
        () => document.querySelectorAll('[data-item-id]').length === 3,
        undefined,
        { timeout: 15_000 },
      )
      assertGeometry(await readGeometry(page))

      // The narrow toolbar folds reverse/shuffle/help into the "…" menu so the
      // header stays dense. Open it and check the folded actions keep 44px.
      assert.equal(
        await page.evaluate(
          () =>
            getComputedStyle(document.querySelector('[data-help-button]') as HTMLElement).display,
        ),
        'none',
        'the ? control folds into the menu at 390px',
      )
      await page.locator('[data-lists-more] summary').click()
      let menuAction = page.locator('[data-reverse-menu-action]')
      await menuAction.waitFor({ state: 'visible', timeout: 5_000 })
      let menuActionHeight = await menuAction.evaluate(
        (el: HTMLElement) => el.getBoundingClientRect().height,
      )
      assert.ok(menuActionHeight >= 44, 'folded toolbar actions keep a 44px target')
    } finally {
      await pool.query('DELETE FROM lists WHERE id = $1', [listId])
    }
  })
})
