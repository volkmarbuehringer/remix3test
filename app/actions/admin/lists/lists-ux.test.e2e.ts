import { describe, it, before, afterEach, type TestContext } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../../test-router.ts'
import { routes } from '../../../routes.ts'
import { createAuthCookieWithCsrfForUser } from '../../../../test/utils.ts'
import { initializeAppDatabase } from '../../../db.ts'
import { pool } from '../../../../test/pool.ts'

// ---------------------------------------------------------------------------
// /admin/lists UX contracts that need a real browser:
//
// - live search: typing in the filter runs the GET form after a pause, narrows
//   the grid, and keeps focus in the field so typing can continue;
// - phone layout: rows become labelled cards, row actions stay on screen, and
//   the page scrolls instead of a short nested row region;
// - desktop row actions: no visible action column; the cluster is revealed by
//   hovering the row or tabbing to one of its buttons;
// - editor: opening a row focuses its title field, and the header close action
//   returns to the grid.
//
// Requires a running PostgreSQL database (global test setup) and a Playwright
// browser. Runs as CI-only (gated on `type: ["e2e"]`).
// ---------------------------------------------------------------------------

describe('admin lists: UX', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  afterEach(async () => {
    await pool.query("DELETE FROM lists WHERE description LIKE 'test-ux-list-%'")
  })

  async function seed(
    descriptions: string[],
    items: Array<{ id: string; label: string }> = [],
  ): Promise<number[]> {
    let now = Date.now()
    let ids: number[] = []
    for (let [index, description] of descriptions.entries()) {
      let inserted = await pool.query(
        `INSERT INTO lists (title, description, list, created_at, updated_at)
         VALUES ($1, $2, $3::jsonb, $4, $4)
         RETURNING id`,
        ['UX ' + description, description, JSON.stringify(items), now + index],
      )
      ids.push(inserted.rows[0].id as number)
    }
    return ids
  }

  async function openListsPage(t: TestContext) {
    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')

    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page
      .context()
      .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])

    await page.goto(routes.admin.lists.index.href())
    await page.locator('[data-lists-table]').waitFor({ timeout: 15_000 })
    // The table is server-rendered; wait for the live-search entry to hydrate
    // before typing so keystrokes cannot land in a dead field.
    await page
      .locator('form[data-lists-filter][data-filter-autosubmit-ready="true"]')
      .waitFor({ timeout: 15_000 })
    return page
  }

  it('filters as you type and keeps focus in the search field', async (t) => {
    await seed(['test-ux-list-alpha', 'test-ux-list-beta'])
    let page = await openListsPage(t)

    let input = page.locator('form[data-lists-filter] input[name="filter"]')
    await input.click()
    await input.pressSequentially('test-ux-list-alpha', { delay: 40 })

    await page.waitForFunction(
      () => new URL(location.href).searchParams.get('filter') === 'test-ux-list-alpha',
      undefined,
      { timeout: 15_000 },
    )
    await page.waitForFunction(
      () => {
        let rows = [...document.querySelectorAll('[data-lists-table] tbody tr')].map(
          (row) => row.textContent ?? '',
        )
        return (
          rows.some((text) => text.includes('test-ux-list-alpha')) &&
          !rows.some((text) => text.includes('test-ux-list-beta'))
        )
      },
      undefined,
      { timeout: 15_000 },
    )

    assert.ok(
      await page.evaluate(() =>
        document.activeElement?.matches('form[data-lists-filter] input[name="filter"]'),
      ),
      'focus must stay in the search field so typing can continue after the reload',
    )

    // The frame swaps its whole content, so a live region inside it would not
    // announce. The document shell mirrors the footer into a persistent status.
    await page.waitForFunction(
      () => {
        let info = document.querySelector('[data-pagination-info]')?.textContent?.trim()
        let status = document.querySelector('[data-grid-status]')?.textContent?.trim()
        return Boolean(info) && status === info
      },
      undefined,
      { timeout: 15_000 },
    )

    // Clearing the field runs the live search too, so the previously hidden row
    // comes back without another click.
    await page.keyboard.press('ControlOrMeta+A')
    await page.keyboard.press('Backspace')
    await page.waitForFunction(
      () => !new URL(location.href).searchParams.get('filter'),
      undefined,
      { timeout: 15_000 },
    )
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('[data-lists-table] tbody tr')].some((row) =>
          (row.textContent ?? '').includes('test-ux-list-beta'),
        ),
      undefined,
      { timeout: 15_000 },
    )
  })

  it('renders labelled cards and keeps row actions visible on a phone', async (t) => {
    let token = 'test-ux-list-mobile-' + Date.now()
    await seed(
      Array.from({ length: 12 }, (_, index) => `${token}-${index}`),
      [{ id: 'a', label: 'Widget' }],
    )
    let page = await openListsPage(t)

    await page.goto(routes.admin.lists.index.href() + '?filter=' + token)
    await page.locator('[data-lists-table]').waitFor({ timeout: 15_000 })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.locator('[data-lists-table]').waitFor({ timeout: 15_000 })
    await page.waitForTimeout(300)

    let layout = await page.evaluate(() => {
      let scroller = document.querySelector('[data-page-scroller]') as HTMLElement
      let wrap = document.querySelector('[data-lists-table]') as HTMLElement
      let cells = [...document.querySelectorAll('[data-lists-table] tbody td')]
      let firstEdit = document.querySelector(
        '[data-lists-table] tbody [aria-label*="bearbeiten"]',
      ) as HTMLElement | null
      let firstActions = document.querySelector(
        '[data-lists-table] tbody [data-lists-row-actions]',
      ) as HTMLElement | null
      return {
        headerDisplay: getComputedStyle(
          document.querySelector('[data-lists-table] thead') as HTMLElement,
        ).display,
        unlabelledCells: cells.filter((cell) => !cell.getAttribute('data-label')).length,
        horizontalOverflow: wrap.scrollWidth - wrap.clientWidth,
        wrapOverflowY: wrap.scrollHeight - wrap.clientHeight,
        pageOverflow: scroller.scrollHeight - scroller.clientHeight,
        editVisible: !!firstEdit && firstEdit.getBoundingClientRect().width > 0,
        actionsOpacity: firstActions ? getComputedStyle(firstActions).opacity : 'missing',
        sortVisible:
          getComputedStyle(document.querySelector('[data-mobile-sort]') as HTMLElement).display !==
          'none',
      }
    })

    assert.equal(layout.headerDisplay, 'none', 'phones should hide the table header')
    assert.equal(layout.unlabelledCells, 0, 'every card cell needs a data-label')
    assert.ok(
      layout.horizontalOverflow <= 1,
      `cards must not overflow, got ${layout.horizontalOverflow}`,
    )
    assert.ok(
      layout.wrapOverflowY <= 1,
      `the row region must not clip its rows, got ${layout.wrapOverflowY}`,
    )
    assert.ok(layout.pageOverflow > 0, 'the page itself should scroll')
    assert.ok(layout.editVisible, 'the row edit action must stay on screen')
    assert.equal(layout.actionsOpacity, '1', 'cards must not hide the action cluster')
    assert.ok(layout.sortVisible, 'phones need their own sort controls')
  })

  it('caps the expanded element list and truncates labels with tooltips', async (t) => {
    let token = 'test-ux-list-expand-' + Date.now()
    let longLabel = 'Test-Element-' + 'x'.repeat(120)
    let items = Array.from({ length: 30 }, (_, index) => ({
      id: String(index),
      label: index === 0 ? longLabel : 'Element ' + index,
    }))
    await seed([token], items)
    let page = await openListsPage(t)

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(routes.admin.lists.index.href() + '?filter=' + token)
    await page.locator('[data-lists-table]').waitFor({ timeout: 15_000 })
    await page.locator('[data-lists-table] summary').first().click()

    let layout = await page.evaluate(() => {
      let panel = document.querySelector('[data-lists-items-panel]') as HTMLElement
      let label = panel.querySelector('[data-list-item-label]') as HTMLElement
      let row = panel.closest('tr') as HTMLElement
      return {
        panelHeight: panel.getBoundingClientRect().height,
        panelClient: panel.clientHeight,
        panelScroll: panel.scrollHeight,
        overflowY: getComputedStyle(panel).overflowY,
        rowHeight: row.getBoundingClientRect().height,
        title: label.getAttribute('title'),
        labelClient: label.clientWidth,
        labelScroll: label.scrollWidth,
        textOverflow: getComputedStyle(label).textOverflow,
        whiteSpace: getComputedStyle(label).whiteSpace,
      }
    })

    assert.ok(
      layout.panelHeight <= 200,
      `the expanded panel should be capped, got ${layout.panelHeight}`,
    )
    assert.ok(
      layout.panelScroll > layout.panelClient,
      'the capped panel should scroll its remaining items',
    )
    assert.equal(layout.overflowY, 'auto', 'the capped panel should own the scroll')
    assert.ok(
      layout.rowHeight < 500,
      `the row must stay bounded instead of growing to every element, got ${layout.rowHeight}`,
    )
    assert.equal(
      layout.title,
      longLabel,
      'a truncated label should expose its full text through a tooltip',
    )
    assert.ok(
      layout.labelScroll > layout.labelClient,
      'the long label should be visually truncated',
    )
    assert.equal(layout.textOverflow, 'ellipsis')
    assert.equal(layout.whiteSpace, 'nowrap')
  })

  it('reveals row actions on hover and keyboard focus without a visible action column', async (t) => {
    let token = 'test-ux-list-hover-' + Date.now()
    let [id] = await seed([token])
    assert.ok(id, 'seed row must be created')
    let page = await openListsPage(t)

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(routes.admin.lists.index.href() + '?filter=' + token)
    await page.locator('[data-lists-table]').waitFor({ timeout: 15_000 })

    let headerText = await page.locator('[data-lists-table] thead').innerText()
    assert.ok(
      !headerText.includes('Aktionen'),
      'the actions gutter must not paint a visible column header',
    )

    let layout = await page.evaluate(() => {
      let wrap = document.querySelector('[data-lists-table]') as HTMLElement
      let headers = [...wrap.querySelectorAll('thead th')]
      let group = wrap.querySelector('tbody [data-lists-row-actions]') as HTMLElement
      let row = group.closest('tr') as HTMLElement
      return {
        titleWidth: headers[1]?.getBoundingClientRect().width ?? 0,
        previewWidth: headers[4]?.getBoundingClientRect().width ?? 0,
        actionWidth: headers[6]?.getBoundingClientRect().width ?? 0,
        scroll: wrap.scrollWidth - wrap.clientWidth,
        overlayGap: row.getBoundingClientRect().right - group.getBoundingClientRect().right,
      }
    })
    assert.ok(
      layout.titleWidth > layout.previewWidth,
      `the title column should absorb the reclaimed action space, got ${layout.titleWidth}px vs ${layout.previewWidth}px preview`,
    )
    assert.ok(
      layout.actionWidth <= 1,
      `the action column must consume no width, got ${layout.actionWidth}px`,
    )
    assert.ok(
      layout.scroll <= 1,
      `reclaiming the width must not cause horizontal scrolling, got ${layout.scroll}px`,
    )
    assert.ok(
      layout.overlayGap >= 0 && layout.overlayGap <= 12,
      `the actions should sit just inside the row's right edge, got ${layout.overlayGap}px gap`,
    )

    let row = page.locator('[data-row-id="' + id + '"]')
    let actions = row.locator('[data-lists-row-actions]')
    let opacity = () => actions.evaluate((el) => getComputedStyle(el).opacity)
    assert.equal(await opacity(), '0', 'desktop rows start without visible actions')

    await row.hover()
    await page.waitForFunction(
      () => {
        let group = document.querySelector('[data-lists-table] tbody [data-lists-row-actions]')
        return group ? getComputedStyle(group).opacity === '1' : false
      },
      undefined,
      { timeout: 15_000 },
    )
    assert.equal(await opacity(), '1', 'hovering the row should reveal its actions')

    await page.mouse.move(1, 1)
    await page.waitForFunction(
      () => {
        let group = document.querySelector('[data-lists-table] tbody [data-lists-row-actions]')
        return group ? getComputedStyle(group).opacity === '0' : true
      },
      undefined,
      { timeout: 15_000 },
    )
    assert.equal(await opacity(), '0', 'leaving the row should hide its actions again')

    // Keyboard focus must reveal the cluster too. Start from the search field
    // and tab into the single filtered row's action links.
    let input = page.locator('form[data-lists-filter] input[name="filter"]')
    await input.focus()
    let focused = false
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab')
      let label = await page.evaluate(
        () => document.activeElement?.getAttribute('aria-label') ?? '',
      )
      if (label.includes('bearbeiten')) {
        focused = true
        break
      }
    }
    assert.ok(focused, 'the row edit action should be reachable by keyboard')
    await page.waitForFunction(
      () => {
        let group = document.querySelector('[data-lists-table] tbody [data-lists-row-actions]')
        return group ? getComputedStyle(group).opacity === '1' : false
      },
      undefined,
      { timeout: 15_000 },
    )
    assert.equal(await opacity(), '1', 'keyboard focus should reveal the action cluster')
  })

  it('focuses the editor title and returns to the grid from the header close action', async (t) => {
    let token = 'test-ux-list-editor-' + Date.now()
    let [id] = await seed([token])
    assert.ok(id, 'seed row must be created')
    let page = await openListsPage(t)

    await page.goto(routes.admin.lists.index.href() + '?filter=' + token)
    await page.locator('[data-lists-table]').waitFor({ timeout: 15_000 })

    // Desktop hides the cluster until the row is hovered.
    let row = page.locator(`[data-row-id="${id}"]`)
    await row.hover()
    await row.locator('[aria-label*="bearbeiten"]').click()
    await page.waitForURL((url) => url.searchParams.get('editing') === String(id), {
      timeout: 15_000,
    })
    await page.waitForFunction(() => document.activeElement?.matches('#al-title'), undefined, {
      timeout: 15_000,
    })

    await page.getByRole('link', { name: 'Editor schließen' }).click()
    await page.waitForFunction(
      () => !new URL(location.href).searchParams.get('editing'),
      undefined,
      { timeout: 15_000 },
    )
  })
})
