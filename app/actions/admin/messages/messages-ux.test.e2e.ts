import { describe, it, before, afterEach, type TestContext } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../../test-router.ts'
import { routes } from '../../../routes.ts'
import { createAuthCookieWithCsrfForUser } from '../../../../test/utils.ts'
import { initializeAppDatabase } from '../../../db.ts'
import { pool } from '../../../../test/pool.ts'

// ---------------------------------------------------------------------------
// /admin/messages UX contracts that need a real browser:
//
// - live search: typing in the filter runs the GET form after a pause, narrows
//   the grid, and keeps focus in the field so typing can continue;
// - phone layout: rows become labelled cards, the actions stay on screen, and
//   the page scrolls instead of a short nested row region.
//
// Requires a running PostgreSQL database (global test setup) and a Playwright
// browser. Runs as CI-only (gated on `type: ["e2e"]`).
// ---------------------------------------------------------------------------

describe('admin messages: UX', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  afterEach(async () => {
    await pool.query("DELETE FROM messages WHERE content LIKE 'test-ux-msg-%'")
  })

  async function seed(contents: string[]): Promise<void> {
    let now = Date.now()
    for (let [index, content] of contents.entries()) {
      await pool.query(
        `INSERT INTO messages (sender_id, content, created_at)
         VALUES ((SELECT id FROM users WHERE email = 'admin@newapp.com'), $1, $2)`,
        [content, now + index],
      )
    }
  }

  async function openMessagesPage(t: TestContext) {
    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')

    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page
      .context()
      .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])

    await page.goto(routes.admin.messages.index.href())
    await page.locator('[data-messages-table]').waitFor({ timeout: 15_000 })
    return page
  }

  it('filters as you type and keeps focus in the search field', async (t) => {
    await seed(['test-ux-msg-alpha', 'test-ux-msg-beta'])
    let page = await openMessagesPage(t)

    let input = page.locator('form[data-messages-filter] input[name="filter"]')
    await input.click()
    await input.pressSequentially('test-ux-msg-alpha', { delay: 40 })

    await page.waitForFunction(
      () => new URL(location.href).searchParams.get('filter') === 'test-ux-msg-alpha',
      undefined,
      { timeout: 15_000 },
    )
    await page.waitForFunction(
      () => {
        let texts = [...document.querySelectorAll('[data-message-text]')].map(
          (node) => node.textContent ?? '',
        )
        return (
          texts.some((text) => text.includes('test-ux-msg-alpha')) &&
          !texts.some((text) => text.includes('test-ux-msg-beta'))
        )
      },
      undefined,
      { timeout: 15_000 },
    )

    assert.ok(
      await page.evaluate(() =>
        document.activeElement?.matches('form[data-messages-filter] input[name="filter"]'),
      ),
      'focus must stay in the search field so typing can continue after the reload',
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
        [...document.querySelectorAll('[data-message-text]')].some((node) =>
          node.textContent?.includes('test-ux-msg-beta'),
        ),
      undefined,
      { timeout: 15_000 },
    )
  })

  it('renders labelled cards and keeps row actions visible on a phone', async (t) => {
    await seed([
      ...Array.from({ length: 12 }, (_, index) => `test-ux-msg-mobile-${index}`),
      `test-ux-msg-mobile-long ${'lorem ipsum '.repeat(40)}`,
    ])
    let page = await openMessagesPage(t)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.locator('[data-messages-table]').waitFor({ timeout: 15_000 })
    // MessageExpand hydrates and scans the clamped cells after the frame render;
    // long rows reveal their "Mehr" toggle only after that sweep.
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('button[data-expand-msg]')].some(
          (button) => getComputedStyle(button).display !== 'none',
        ),
      undefined,
      { timeout: 15_000 },
    )

    let layout = await page.evaluate(() => {
      let scroller = document.querySelector('[data-page-scroller]') as HTMLElement
      let wrap = document.querySelector('[data-messages-table]') as HTMLElement
      let cells = [...document.querySelectorAll('[data-messages-table] tbody td')]
      let firstDelete = document.querySelector(
        '[data-messages-table] tbody button[type="submit"]',
      ) as HTMLElement | null
      return {
        headerDisplay: getComputedStyle(
          document.querySelector('[data-messages-table] thead') as HTMLElement,
        ).display,
        unlabelledCells: cells.filter((cell) => !cell.getAttribute('data-label')).length,
        horizontalOverflow: wrap.scrollWidth - wrap.clientWidth,
        wrapOverflowY: wrap.scrollHeight - wrap.clientHeight,
        pageOverflow: scroller.scrollHeight - scroller.clientHeight,
        deleteVisible: !!firstDelete && firstDelete.getBoundingClientRect().width > 0,
        sortVisible:
          getComputedStyle(document.querySelector('[data-mobile-sort]') as HTMLElement).display !==
          'none',
        expandVisible: [...document.querySelectorAll('button[data-expand-msg]')].some(
          (button) => getComputedStyle(button).display !== 'none',
        ),
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
    assert.ok(layout.deleteVisible, 'the row delete action must stay on screen')
    assert.ok(layout.sortVisible, 'phones need their own sort controls')
    assert.ok(layout.expandVisible, 'long messages need their Mehr toggle on a card')
  })
})
