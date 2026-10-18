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

      await page.locator('[data-status-filter="open"]').click()
      await page.waitForFunction(
        () => document.querySelectorAll('[data-item-id]').length === 2,
        undefined,
        { timeout: 5_000 },
      )
      await page.locator('[data-status-filter="overdue"]').click()
      await page.waitForFunction(
        () => document.querySelectorAll('[data-item-id]').length === 1,
        undefined,
        { timeout: 5_000 },
      )
      await page.locator('[data-status-filter="all"]').click()
      await page.waitForFunction(
        () => document.querySelectorAll('[data-item-id]').length === 3,
        undefined,
        { timeout: 5_000 },
      )

      await page.locator('[data-hide-done]').click()
      await page.waitForFunction(
        () => document.querySelectorAll('[data-item-id]').length === 2,
        undefined,
        { timeout: 5_000 },
      )
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
    } finally {
      await pool.query('DELETE FROM lists WHERE id = $1', [listId])
    }
  })
})
