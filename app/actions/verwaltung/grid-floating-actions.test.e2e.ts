import { describe, it, before, after, type TestContext } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../test-router.ts'
import { routes } from '../../routes.ts'
import { createAuthCookieWithCsrfForUser } from '../../../test/utils.ts'
import { initializeAppDatabase } from '../../db.ts'
import { pool } from '../../../test/pool.ts'

// ---------------------------------------------------------------------------
// /verwaltung grids migrated to the shared persistent-kebab + hover-overlay row
// actions. All four data grids must reserve the same 44px gutter above the
// floating breakpoint and keep the visible action column below it.
//
// Requires a running PostgreSQL database (global test setup) and a Playwright
// browser. Runs as CI-only (gated on `type: ["e2e"]`).
// ---------------------------------------------------------------------------

const TOKEN_PREFIX = `test-verwaltung-floating-${Date.now()}-`

interface GridCase {
  label: string
  path: string
  tableAttr: string
}

const CASES: GridCase[] = [
  {
    label: 'appointments',
    path:
      routes.verwaltung.appointments.index.href() +
      '?status=all&filter=' +
      encodeURIComponent(TOKEN_PREFIX),
    tableAttr: 'data-appointments-table',
  },
  {
    label: 'offerings',
    path:
      routes.verwaltung.offerings.index.href() +
      '?status=all&filter=' +
      encodeURIComponent(TOKEN_PREFIX),
    tableAttr: 'data-offerings-table',
  },
  {
    label: 'resources',
    path: routes.verwaltung.resources.index.href() + '?filter=' + encodeURIComponent(TOKEN_PREFIX),
    tableAttr: 'data-resources-table',
  },
  {
    label: 'offering-configs',
    path:
      routes.verwaltung.offeringConfigs.index.href() +
      '?filter=' +
      encodeURIComponent(TOKEN_PREFIX),
    tableAttr: 'data-offering-configs-table',
  },
]

describe('verwaltung grids: floating row actions', () => {
  before(async () => {
    await initializeAppDatabase()

    let now = Date.now()
    let futureDay = now + 7 * 86_400_000
    let resource = await pool.query(
      `INSERT INTO resources (name, description, capabilities, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $4)
       RETURNING id`,
      [`${TOKEN_PREFIX} resource`, `${TOKEN_PREFIX} description`, TOKEN_PREFIX, now],
    )
    let resourceId = resource.rows[0].id as number

    await pool.query(
      `INSERT INTO offering_configs (resource_id, rules, created_at, updated_at)
       VALUES ($1, $2::jsonb, $3, $3)`,
      [resourceId, JSON.stringify({ monday: [540, 600] }), now],
    )
    await pool.query(
      `INSERT INTO appointoffering (day, resource_id, during, created_at, updated_at)
       VALUES ($1, $2, '[540,600)', $3, $3)`,
      [futureDay, resourceId, now],
    )

    let admin = await pool.query(`SELECT id FROM users WHERE email = $1`, ['admin@newapp.com'])
    assert.ok(admin.rows[0]?.id, 'seeded admin user must exist')
    await pool.query(
      `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
       VALUES ($1, $2, $3, $4, '[600,660)', $5, $5)`,
      [admin.rows[0].id, resourceId, `${TOKEN_PREFIX} appointment`, futureDay, now],
    )
  })

  after(async () => {
    await pool.query(
      `DELETE FROM appointments
       WHERE resource_id IN (SELECT id FROM resources WHERE name LIKE $1)`,
      [`${TOKEN_PREFIX}%`],
    )
    await pool.query(
      `DELETE FROM offering_configs
       WHERE resource_id IN (SELECT id FROM resources WHERE name LIKE $1)`,
      [`${TOKEN_PREFIX}%`],
    )
    await pool.query(
      `DELETE FROM appointoffering
       WHERE resource_id IN (SELECT id FROM resources WHERE name LIKE $1)`,
      [`${TOKEN_PREFIX}%`],
    )
    await pool.query('DELETE FROM resources WHERE name LIKE $1', [`${TOKEN_PREFIX}%`])
  })

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
      let trigger = wrap.querySelector('tbody [data-row-actions-trigger]') as HTMLElement
      let trailing = wrap.querySelector('tbody [data-floating-trailing]') as HTMLElement | null
      let groupRect = group.getBoundingClientRect()
      let triggerRect = trigger.getBoundingClientRect()
      return {
        actionWidth: headers[headers.length - 1]?.getBoundingClientRect().width ?? -1,
        headerText: header.innerText,
        opacity: getComputedStyle(group).opacity,
        pointerEvents: getComputedStyle(group).pointerEvents,
        trailingOpacity: trailing ? getComputedStyle(trailing).opacity : 'missing',
        triggerDisplay: getComputedStyle(trigger).display,
        triggerExpanded: trigger.getAttribute('aria-expanded'),
        triggerWidth: triggerRect.width,
        triggerHeight: triggerRect.height,
        gapToTrigger: triggerRect.left - groupRect.right,
      }
    }, tableAttr)
  }

  for (let grid of CASES) {
    it(`${grid.label}: reveals actions from the persistent kebab above the breakpoint`, async (t) => {
      let page = await openGrid(t, grid.path)
      await page.locator('[' + grid.tableAttr + ']').waitFor({ timeout: 15_000 })
      let row = page.locator('[' + grid.tableAttr + '] tbody tr[data-row-id]').first()
      await row.waitFor({ timeout: 15_000 })

      let resting = await readGrid(page, grid.tableAttr)
      assert.equal(resting.opacity, '0', `${grid.label}: the cluster must start hidden`)
      assert.ok(
        resting.actionWidth >= 42 && resting.actionWidth <= 46,
        `${grid.label}: the action column must reserve a 44px kebab gutter, got ${resting.actionWidth}px`,
      )
      assert.ok(
        !resting.headerText.toLowerCase().includes('aktionen'),
        `${grid.label}: the visible action header must be hidden above the breakpoint`,
      )
      assert.notEqual(resting.triggerDisplay, 'none', `${grid.label}: kebab must stay visible`)
      assert.equal(resting.triggerExpanded, 'false', `${grid.label}: kebab must start collapsed`)
      assert.ok(
        resting.triggerWidth > 0 && resting.triggerHeight > 0,
        `${grid.label}: kebab needs a clickable box`,
      )
      assert.ok(
        resting.gapToTrigger >= 0 && resting.gapToTrigger <= 12,
        `${grid.label}: overlay must sit just left of the kebab, got ${resting.gapToTrigger}px gap`,
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
      assert.equal(hovered.opacity, '1', `${grid.label}: row hover must reveal actions`)
      assert.equal(
        hovered.pointerEvents,
        'auto',
        `${grid.label}: revealed actions must accept clicks`,
      )
      assert.equal(
        hovered.trailingOpacity,
        '0',
        `${grid.label}: the trailing cell must fade under the overlay`,
      )

      await page
        .locator('[data-admin-row-actions-ready="true"]')
        .waitFor({ state: 'attached', timeout: 15_000 })
      let trigger = row.locator('[data-row-actions-trigger]')
      await trigger.click()
      assert.equal(await trigger.getAttribute('aria-expanded'), 'true')
      assert.ok(
        await page.evaluate(() => document.activeElement?.closest('[data-row-actions]') !== null),
        `${grid.label}: opening the kebab must focus the first row action`,
      )
      await page.keyboard.press('Escape')
      assert.equal(await trigger.getAttribute('aria-expanded'), 'false')
      assert.ok(
        await trigger.evaluate((el) => document.activeElement === el),
        `${grid.label}: Escape must return focus to the kebab`,
      )

      await page.setViewportSize({ width: 1100, height: 900 })
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page
        .locator('[' + grid.tableAttr + '] tbody tr[data-row-id]')
        .first()
        .waitFor({
          timeout: 15_000,
        })
      let narrow = await readGrid(page, grid.tableAttr)
      assert.equal(
        narrow.triggerDisplay,
        'none',
        `${grid.label}: the kebab must disappear below the breakpoint`,
      )
      assert.equal(narrow.opacity, '1', `${grid.label}: the action cluster stays in flow`)
      assert.ok(narrow.actionWidth > 1, `${grid.label}: the action column keeps its width`)
      assert.ok(
        narrow.headerText.toLowerCase().includes('aktionen'),
        `${grid.label}: the visible action header returns below the breakpoint`,
      )
    })
  }
})
