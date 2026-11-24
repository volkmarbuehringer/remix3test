import { describe, it, before, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../test-router.ts'
import { routes, frames } from '../../routes.ts'
import { createAuthCookieWithCsrfForUser, createTestUser } from '../../../test/utils.ts'
import { initializeAppDatabase } from '../../db.ts'
import { pool } from '../../../test/pool.ts'

// ---------------------------------------------------------------------------
// `/lists` sidebar pager — frame prefetch end-to-end.
//
// The prev/next controls are pinned outside the scrolling sidebar and always
// visible, so they use `intent` (not `viewport`: warming both neighbours on
// every page load would defeat the purpose). The contract mirrors the admin
// sidebar and grid pagers: hover warms exactly one `lists-content` fragment
// through the app resolver, and the click must claim it without a second SSR.
// ---------------------------------------------------------------------------

const PREFIX = 'test-prefetch-lists-pager'
let userId: number | undefined

describe('lists sidebar: frame prefetch', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  afterEach(async () => {
    if (userId == null) return
    await pool.query('DELETE FROM lists WHERE user_id = $1', [userId])
    await pool.query('DELETE FROM users WHERE id = $1', [userId])
    userId = undefined
  })

  it('serves the clicked next page from the hover warm', async (t) => {
    let email = `${PREFIX}-${Date.now()}@example.com`
    let createdUserId = await createTestUser(email)
    assert.ok(createdUserId, 'test user must be created')
    userId = createdUserId

    // Future timestamps put all 20 lists on the first two "recent" pages even
    // when other users' lists exist. A dedicated customer keeps them out of
    // the admin-scoped lists suites.
    let base = Date.now() + 10_000_000
    for (let index = 0; index < 20; index++) {
      await pool.query(
        `INSERT INTO lists (user_id, title, description, list, created_at, updated_at)
         VALUES ($1, $2, $3, $4::jsonb, $5, $5)`,
        [createdUserId, `Prefetch ${index}`, PREFIX, JSON.stringify([]), base + index],
      )
    }

    let auth = await createAuthCookieWithCsrfForUser(email)
    assert.ok(auth?.cookie, 'session must be created')

    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page
      .context()
      .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])

    await page.goto(routes.lists.index.href())
    await page.locator('#lists-sidebar-search').waitFor({ timeout: 15_000 })

    let next = page
      .locator('#sidebar-shell-nav')
      .getByRole('link', { name: 'Nächste Seite', exact: true })
    await next.waitFor({ timeout: 15_000 })
    await next.scrollIntoViewIfNeeded()

    assert.equal(await next.getAttribute('data-rmx-prefetch'), 'intent')
    assert.equal(await next.getAttribute('data-rmx-target'), frames.listsContent)

    let href = await next.getAttribute('href')
    assert.ok(href, 'the pager must carry an href')
    let target = new URL(href, server.baseUrl).href
    assert.equal(new URL(target).searchParams.get('offset'), '15')

    let requests = 0
    page.on('request', (request) => {
      if (request.url() === target) requests++
    })

    let warm = page.waitForResponse(
      (response) =>
        response.url() === target && response.request().headers()['x-remix-frame'] === 'true',
      { timeout: 15_000 },
    )
    await next.hover()
    await warm

    assert.equal(requests, 1, 'hovering the marked pager warms exactly one fragment request')

    await next.click()
    await page.waitForURL((url) => url.searchParams.get('offset') === '15', { timeout: 15_000 })

    assert.equal(requests, 1, 'the click must reuse the warmed response, not fetch a second SSR')
  })
})
