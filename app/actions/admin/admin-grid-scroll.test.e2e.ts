import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../test-router.ts'
import { routes } from '../../routes.ts'
import { createAuthCookieWithCsrfForUser } from '../../test-utils.ts'
import { initializeAppDatabase } from '../../db.ts'
import { pool } from '../../data/test-pool.ts'

// /admin/messages is a bounded grid: the shell fills the page, the compose
// toolbar and pagination stay put, and only the row region (`data-grid-scroll`)
// scrolls. Paging resets that region to the top instead of clamping the previous
// offset (which made variable-height rows jump).
describe('admin grid paging scroll reset', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  it('keeps the messages page bounded and resets the row region on paging', async (t) => {
    // Seed enough rows for at least two full pages at the default page size (10).
    let now = Date.now()
    let seeded: number[] = []
    for (let i = 0; i < 22; i++) {
      let text = i % 2 === 0 ? `short row ${i}` : 'lorem '.repeat(1 + (i % 6)) + `long row ${i}`
      let row = await pool.query(
        `INSERT INTO messages (sender_id, content, created_at) VALUES ($1, $2, $3) RETURNING id`,
        [null, text, now - i * 1000],
      )
      seeded.push(row.rows[0].id)
    }

    try {
      let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
      assert.ok(auth?.cookie, 'admin session must be created')
      let server = await createTestServer((request) => router.fetch(request))
      let page = await t.serve(server)
      await page
        .context()
        .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])

      await page.goto(routes.admin.messages.index.href())
      await page.locator('[data-messages-table]').waitFor({ timeout: 15_000 })
      // Wait for PageScrollReset to hydrate before navigating.
      await page.waitForTimeout(1_000)

      let layout = await page.evaluate(() => {
        let pageEl = document.querySelector('[data-page-scroller]') as HTMLElement
        let wrap = document.querySelector('[data-grid-scroll]') as HTMLElement
        return {
          pageOverflow: pageEl.scrollHeight - pageEl.clientHeight,
          wrapOverflow: wrap.scrollHeight - wrap.clientHeight,
        }
      })
      assert.ok(layout.pageOverflow <= 1, `the page must not scroll, got ${layout.pageOverflow}`)
      assert.ok(layout.wrapOverflow > 0, 'the row region must scroll')

      await page.evaluate(() => {
        let wrap = document.querySelector('[data-grid-scroll]') as HTMLElement
        wrap.scrollTop = wrap.scrollHeight
      })
      let beforeScroll = await page.evaluate(
        () => (document.querySelector('[data-grid-scroll]') as HTMLElement).scrollTop,
      )
      assert.ok(beforeScroll > 0, `the row region should be scrolled, got ${beforeScroll}`)

      await page
        .getByRole('link', { name: /Weiter/ })
        .first()
        .click()
      await page.waitForTimeout(1_500)

      let afterScroll = await page.evaluate(
        () => (document.querySelector('[data-grid-scroll]') as HTMLElement).scrollTop,
      )
      assert.equal(afterScroll, 0, 'paging must return the row region to the top')
    } finally {
      await pool.query('DELETE FROM messages WHERE id = ANY($1)', [seeded])
    }
  })

  it('bounds the clients grid so its pagination stays put', async (t) => {
    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')
    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page
      .context()
      .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])

    await page.goto(routes.admin.clients.index.href())
    await page.locator('[data-clients-table]').waitFor({ timeout: 15_000 })
    await page.waitForTimeout(500)

    let layout = await page.evaluate(() => {
      let pageEl = document.querySelector('[data-page-scroller]') as HTMLElement
      let wrap = document.querySelector('[data-clients-table-wrap]') as HTMLElement
      return {
        pageOverflow: pageEl.scrollHeight - pageEl.clientHeight,
        wrapOverflow: wrap.scrollHeight - wrap.clientHeight,
      }
    })
    assert.ok(layout.pageOverflow <= 1, `the page must not scroll, got ${layout.pageOverflow}`)
    assert.ok(layout.wrapOverflow > 0, 'the client rows must scroll')
  })
})
