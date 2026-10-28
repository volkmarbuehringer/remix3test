import { describe, it, before, afterEach, type TestContext } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../test-router.ts'
import { routes } from '../../routes.ts'
import { createAuthCookieWithCsrfForUser } from '../../../test/utils.ts'
import { initializeAppDatabase } from '../../db.ts'
import { __setTestChatlogFixtures } from './chatlog/controller.tsx'

// ---------------------------------------------------------------------------
// Floating row actions on the grids migrated to `table.floatingActions*`
// (users, chatlog). The shared mixin hides the cluster and zeroes the action
// column on `(min-width: 1200px) and (hover: hover)`; below that breakpoint the
// same markup must keep the action column and its visible header. The /lists
// grid has its own hover/focus coverage in lists-ux.test.e2e.ts.
//
// Requires a running PostgreSQL database (global test setup) and a Playwright
// browser. Runs as CI-only (gated on `type: ["e2e"]`).
// ---------------------------------------------------------------------------

interface GridCase {
  label: string
  path: string
  tableAttr: string
  rowAttr: string
}

/**
 * Escape a value for a quoted CSS attribute selector. `CSS.escape` is a
 * browser global, so the Node-side selector builder cannot rely on it.
 */
function cssAttributeValue(value: string): string {
  return value.replace(/["\\]/g, '\\$&')
}

const CASES: GridCase[] = [
  {
    label: 'users',
    path: routes.admin.users.index.href(),
    tableAttr: 'data-users-table',
    rowAttr: 'data-row-id',
  },
  {
    label: 'chatlog',
    path: routes.admin.chatlog.index.href(),
    tableAttr: 'data-chatlog-table',
    rowAttr: 'data-chatlog-row',
  },
]

describe('admin grids: floating row actions', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  afterEach(() => {
    __setTestChatlogFixtures(undefined)
  })

  function seedChatlog() {
    __setTestChatlogFixtures({
      threads: [{ id: 'e2e-floating-thread', resourceId: '1', createdAt: 3000, updatedAt: 4000 }],
      previews: new Map([
        [
          'e2e-floating-thread',
          { preview: 'E2E Floating', previewFull: 'User: E2E Floating', messageCount: 2 },
        ],
      ]),
    })
  }

  async function openGrid(t: TestContext, path: string) {
    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')
    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page
      .context()
      .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(path)
    return page
  }

  function readGrid(page: Awaited<ReturnType<typeof openGrid>>, tableAttr: string) {
    return page.evaluate((attr: string) => {
      let wrap = document.querySelector('[' + attr + ']') as HTMLElement
      let header = wrap.querySelector('thead') as HTMLElement
      let headers = [...wrap.querySelectorAll('thead th')] as HTMLElement[]
      let group = wrap.querySelector('tbody [data-row-actions]') as HTMLElement
      let trailing = wrap.querySelector('tbody [data-floating-trailing]') as HTMLElement | null
      let row = group.closest('tr') as HTMLElement
      return {
        actionWidth: headers[headers.length - 1]?.getBoundingClientRect().width ?? -1,
        visibleHeader: header.innerText,
        opacity: getComputedStyle(group).opacity,
        pointerEvents: getComputedStyle(group).pointerEvents,
        trailingOpacity: trailing ? getComputedStyle(trailing).opacity : 'missing',
        scroll: wrap.scrollWidth - wrap.clientWidth,
        rowKey: row.getAttribute('data-row-id') ?? row.getAttribute('data-chatlog-row') ?? '',
      }
    }, tableAttr)
  }

  for (let grid of CASES) {
    it(`${grid.label}: hides the cluster above the breakpoint and reveals it on hover`, async (t) => {
      if (grid.label === 'chatlog') seedChatlog()
      let page = await openGrid(t, grid.path)
      await page.locator('[' + grid.tableAttr + ']').waitFor({ timeout: 15_000 })
      await page
        .locator('[' + grid.tableAttr + '] tbody [' + grid.rowAttr + ']')
        .first()
        .waitFor()

      let resting = await readGrid(page, grid.tableAttr)
      assert.equal(
        resting.opacity,
        '0',
        `${grid.label}: desktop rows start without visible actions`,
      )
      assert.ok(
        resting.actionWidth <= 1,
        `${grid.label}: action column must be zero-width, got ${resting.actionWidth}px`,
      )
      assert.ok(
        !resting.visibleHeader.toLowerCase().includes('aktionen'),
        `${grid.label}: the header label must not paint above the overlay`,
      )
      assert.ok(
        resting.scroll <= 1,
        `${grid.label}: zero-width column must not cause overflow, got ${resting.scroll}px`,
      )

      let row = page.locator(
        '[' +
          grid.tableAttr +
          '] tbody [' +
          grid.rowAttr +
          '="' +
          cssAttributeValue(resting.rowKey) +
          '"]',
      )
      await row.hover()
      await page.waitForFunction(
        (attr: string) => {
          let group = document.querySelector('[' + attr + '] tbody [data-row-actions]')
          return group ? getComputedStyle(group).opacity === '1' : false
        },
        grid.tableAttr,
        { timeout: 15_000 },
      )
      let hovered = await readGrid(page, grid.tableAttr)
      assert.equal(
        hovered.opacity,
        '1',
        `${grid.label}: hovering the row should reveal its actions`,
      )
      assert.equal(
        hovered.pointerEvents,
        'auto',
        `${grid.label}: revealed actions must accept clicks`,
      )
      assert.equal(
        hovered.trailingOpacity,
        '0',
        `${grid.label}: the trailing cell should fade under the overlay`,
      )

      await page.mouse.move(1, 1)
      await page.waitForFunction(
        (attr: string) => {
          let group = document.querySelector('[' + attr + '] tbody [data-row-actions]')
          return group ? getComputedStyle(group).opacity === '0' : true
        },
        grid.tableAttr,
        { timeout: 15_000 },
      )
    })

    it(`${grid.label}: keeps the visible action column below the breakpoint`, async (t) => {
      if (grid.label === 'chatlog') seedChatlog()
      let page = await openGrid(t, grid.path)
      await page.locator('[' + grid.tableAttr + ']').waitFor({ timeout: 15_000 })
      await page.setViewportSize({ width: 1100, height: 900 })
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page
        .locator('[' + grid.tableAttr + '] tbody [' + grid.rowAttr + ']')
        .first()
        .waitFor()

      let state = await readGrid(page, grid.tableAttr)
      assert.equal(state.opacity, '1', `${grid.label}: the cluster must stay in flow below 1200px`)
      assert.ok(
        state.actionWidth > 1,
        `${grid.label}: the action column must keep its width below 1200px`,
      )
      assert.ok(
        state.visibleHeader.toLowerCase().includes('aktionen'),
        `${grid.label}: the visible header must return below 1200px`,
      )
    })
  }

  it('users: fades the status cell when the edit panel makes it the trailing cell', async (t) => {
    let page = await openGrid(t, routes.admin.users.index.href())
    await page.locator('[data-users-table]').waitFor({ timeout: 15_000 })
    let editHref = await page
      .locator('[data-users-table] tbody a[href*="editing="]')
      .first()
      .getAttribute('href')
    assert.ok(editHref, 'users: the first row must expose an edit link')
    await page.goto(editHref!)
    await page.locator('[data-users-table]').waitFor({ timeout: 15_000 })

    let focused = await page.evaluate(() => {
      let wrap = document.querySelector('[data-users-table]') as HTMLElement
      let status = wrap.querySelector('tbody td[data-label="Status"]') as HTMLElement | null
      let group = wrap.querySelector('tbody [data-row-actions]') as HTMLElement
      let headers = [...wrap.querySelectorAll('thead th')] as HTMLElement[]
      let row = group.closest('tr') as HTMLElement
      return {
        statusTrailing: status?.hasAttribute('data-floating-trailing') ?? false,
        statusOpacity: status ? getComputedStyle(status).opacity : 'missing',
        groupOpacity: getComputedStyle(group).opacity,
        actionWidth: headers[headers.length - 1]?.getBoundingClientRect().width ?? -1,
        hasCreatedColumn: !!wrap.querySelector('tbody td[data-label="Erstellt"]'),
        rowKey: row.getAttribute('data-row-id') ?? '',
      }
    })
    assert.equal(
      focused.hasCreatedColumn,
      false,
      'users: the focused grid drops the Erstellt column',
    )
    assert.equal(
      focused.statusTrailing,
      true,
      'users: the status cell becomes the faded trailing cell while editing',
    )
    assert.ok(
      focused.actionWidth <= 1,
      `users: the focused grid keeps the zero-width action column, got ${focused.actionWidth}px`,
    )
    assert.equal(focused.groupOpacity, '0', 'users: the focused grid hides the cluster until hover')

    let row = page.locator(
      '[data-users-table] tbody [data-row-id="' + cssAttributeValue(focused.rowKey) + '"]',
    )
    await row.hover()
    await page.waitForFunction(
      () => {
        let group = document.querySelector('[data-users-table] tbody [data-row-actions]')
        return group ? getComputedStyle(group).opacity === '1' : false
      },
      undefined,
      { timeout: 15_000 },
    )
    let statusOpacity = await page.evaluate(() => {
      let status = document.querySelector(
        '[data-users-table] tbody td[data-label="Status"]',
      ) as HTMLElement | null
      return status ? getComputedStyle(status).opacity : 'missing'
    })
    assert.equal(statusOpacity, '0', 'users: the status cell fades under the revealed cluster')
  })

  it('users: keeps blocked own-row actions focusable so the reason stays reachable', async (t) => {
    let page = await openGrid(t, routes.admin.users.index.href())
    await page.locator('[data-users-table]').waitFor({ timeout: 15_000 })

    await page
      .locator('[data-users-table] tbody tr[data-self="true"] a[aria-label*="bearbeiten"]')
      .first()
      .focus()
    await page.keyboard.press('Tab')

    let state = await page.evaluate(() => {
      let group = document.querySelector(
        '[data-users-table] tbody tr[data-self="true"] [data-row-actions]',
      ) as HTMLElement
      return {
        activeLabel: document.activeElement?.getAttribute('aria-label') ?? '',
        activeDisabled: document.activeElement?.getAttribute('aria-disabled'),
        groupOpacity: group ? getComputedStyle(group).opacity : 'missing',
      }
    })
    assert.ok(
      state.activeLabel.includes('eigene Konto'),
      `users: Tab must reach the blocked action, got "${state.activeLabel}"`,
    )
    assert.equal(
      state.activeDisabled,
      'true',
      'users: the blocked action must stay announced as disabled',
    )
    assert.equal(
      state.groupOpacity,
      '1',
      'users: focusing the blocked action must reveal the cluster',
    )
  })
})
