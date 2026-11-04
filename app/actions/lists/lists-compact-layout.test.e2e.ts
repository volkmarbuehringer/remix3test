import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../test-router.ts'
import { initializeAppDatabase } from '../../db.ts'
import { pool } from '../../../test/pool.ts'
import { createAuthCookieWithCsrfForUser } from '../../../test/utils.ts'

// ---------------------------------------------------------------------------
// Compact /lists layout (real SSR + CSS).
//
// Guards the responsive regressions found while auditing the page:
//  - a 390px-wide mouse window kept the 10rem right gutter that the touch
//    layout drops, collapsing item labels to ~2px;
//  - the fixed-width add-item button squeezed the composer field to ~130px;
//  - the app header kept its full link row until 768px, so at 820px the list
//    title input was ~157px wide, the sidebar selects truncated their labels,
//    and the header pushed the theme toggle past the viewport;
//  - the status strip wrapped the last tab onto its own 44px row at 360px.
//
// Behavioural suites cover interactions; this one only measures geometry.
// ---------------------------------------------------------------------------

type LayoutMetrics = {
  innerWidth: number
  documentScrollWidth: number
  cardRight: number
  labelWidths: number[]
  composerWidth: number
  kebabDisplay: string
  clusterDisplay: string
  titleWidth: number
  statusBarHeight: number
  selectWidths: number[]
  bellVisible: boolean
}

async function readLayout(page: { evaluate: Function }): Promise<LayoutMetrics> {
  return (await page.evaluate(() => {
    function widthOf(el: Element | null | undefined): number {
      return el ? el.getBoundingClientRect().width : 0
    }
    let labels = Array.from(
      document.querySelectorAll<HTMLElement>('[data-item-id] > div > span:first-child'),
    )
    let composer = Array.from(document.querySelectorAll<HTMLTextAreaElement>('textarea')).find(
      (el) => el.placeholder === 'Neues Element eingeben…',
    )
    let card = document.querySelector<HTMLElement>('[data-lists-active-id]')
    let kebab = document.querySelector<HTMLElement>('[data-item-menu-button]')
    let cluster = document.querySelector<HTMLElement>('[data-item-actions]')
    let title = document.querySelector<HTMLElement>('#lists-title')
    let bar = document.querySelector<HTMLElement>('[data-status-bar]')
    let selects = Array.from(document.querySelectorAll<HTMLElement>('[data-lists-sidebar-select]'))
    let bell = document.querySelector<HTMLElement>('header a[aria-label="Benachrichtigungen"]')
    return {
      innerWidth: window.innerWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      cardRight: card ? card.getBoundingClientRect().right : 0,
      labelWidths: labels.map((el) => el.getBoundingClientRect().width),
      composerWidth: widthOf(composer),
      kebabDisplay: kebab ? getComputedStyle(kebab).display : 'none',
      clusterDisplay: cluster ? getComputedStyle(cluster).display : 'none',
      titleWidth: widthOf(title),
      statusBarHeight: bar ? bar.getBoundingClientRect().height : 0,
      selectWidths: selects.map((el) => el.getBoundingClientRect().width),
      bellVisible: bell ? bell.getBoundingClientRect().width > 0 : false,
    }
  })) as LayoutMetrics
}

async function waitForRows(page: { waitForFunction: Function }, expected: number) {
  await page.waitForFunction(
    (count: number) => document.querySelectorAll('[data-item-id]').length === count,
    expected,
    { timeout: 15_000 },
  )
}

describe('lists compact layout', () => {
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
      { id: 'compact-1', label: 'Längerer Elementtitel für die kompakte Ansicht' },
      { id: 'compact-2', label: 'Zweiter Eintrag mit ebenfalls langem Text' },
      { id: 'compact-3', label: 'Kurzer Eintrag' },
    ])
    let result = await pool.query(
      'INSERT INTO lists (user_id, title, description, list, created_at, updated_at) VALUES ($1, $2, $3, $4::jsonb, $5, $5) RETURNING id',
      [adminUserId, 'Kompakte Ansicht', 'seeded for the compact layout e2e', items, now],
    )
    listId = Number(result.rows[0]!.id as number)
  }

  it('keeps labels, composer and strip usable at 390 / 820 / 1440', async (t) => {
    await seedList()
    try {
      let server = await createTestServer((request) => router.fetch(request))
      let page = await t.serve(server)
      await page
        .context()
        .addCookies([{ name: 'session', value: adminCookie.slice(8), url: server.baseUrl }])

      // A narrow mouse window (no touch emulation): this is where the touch-
      // only gutter override used to leave the label 2px wide.
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto(`/lists?load=${listId}`)
      await waitForRows(page, 3)
      let narrow = await readLayout(page)
      assert.ok(
        narrow.documentScrollWidth <= narrow.innerWidth + 1,
        `the page must not overflow at 390px (${narrow.documentScrollWidth} > ${narrow.innerWidth})`,
      )
      for (let width of narrow.labelWidths) {
        assert.ok(width >= 80, `item labels must stay readable at 390px (got ${width}px)`)
      }
      assert.ok(
        narrow.composerWidth >= 220,
        `the add-item field must not be squeezed by the button (got ${narrow.composerWidth}px)`,
      )
      assert.notEqual(narrow.kebabDisplay, 'none', 'the kebab replaces the hover cluster at 390px')
      assert.equal(narrow.clusterDisplay, 'none', 'the hover cluster must be hidden at 390px')
      assert.ok(
        narrow.statusBarHeight <= 120,
        `the status strip must stay two compact rows (got ${narrow.statusBarHeight}px)`,
      )
      assert.equal(
        narrow.bellVisible,
        true,
        'the unread notification bell must stay in the header at 390px',
      )

      // Tablet-ish width with the sidebar still visible: the card header and
      // the sidebar controls used to stay on one cramped line.
      await page.setViewportSize({ width: 820, height: 900 })
      await page.goto(`/lists?load=${listId}`)
      await waitForRows(page, 3)
      let compact = await readLayout(page)
      assert.ok(
        compact.documentScrollWidth <= compact.innerWidth + 1,
        `the page must not overflow at 820px (${compact.documentScrollWidth} > ${compact.innerWidth})`,
      )
      assert.ok(
        compact.cardRight <= compact.innerWidth + 1,
        'the editor card must stay inside the viewport at 820px',
      )
      for (let width of compact.labelWidths) {
        assert.ok(width >= 200, `item labels must use the released gutter (got ${width}px)`)
      }
      assert.ok(
        compact.titleWidth >= 250,
        `the title must get its own header row at 820px (got ${compact.titleWidth}px)`,
      )
      assert.notEqual(compact.kebabDisplay, 'none', 'the kebab is available at 820px')
      assert.equal(compact.clusterDisplay, 'none', 'the hover cluster must be hidden at 820px')
      for (let width of compact.selectWidths) {
        assert.ok(width >= 150, `sidebar selects must not truncate their labels (got ${width}px)`)
      }
      assert.equal(
        compact.bellVisible,
        true,
        'the unread notification bell must stay visible when links collapse at 820px',
      )

      // Desktop keeps the hover cluster and the full-width labels.
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto(`/lists?load=${listId}`)
      await waitForRows(page, 3)
      let wide = await readLayout(page)
      assert.equal(wide.bellVisible, true, 'desktop keeps the notification bell')
      assert.equal(wide.kebabDisplay, 'none', 'the kebab is touch/compact-only')
      assert.notEqual(wide.clusterDisplay, 'none', 'desktop keeps the hover action cluster')
      for (let width of wide.labelWidths) {
        assert.ok(width >= 300, `desktop labels must span the row (got ${width}px)`)
      }
    } finally {
      await pool.query('DELETE FROM lists WHERE id = $1', [listId])
    }
  })
})
