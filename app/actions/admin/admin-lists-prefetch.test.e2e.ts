import { describe, it, before, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../test-router.ts'
import { routes } from '../../routes.ts'
import { createAuthCookieWithCsrfForUser } from '../../../test/utils.ts'
import { initializeAppDatabase } from '../../db.ts'
import { pool } from '../../../test/pool.ts'

// ---------------------------------------------------------------------------
// Admin lists filter tabs — frame prefetch end-to-end.
//
// Only the real client runtime (`app/assets/entry.tsx` -> `run({ prefetch })`)
// starts the prefetch listeners and routes the click through `resolveFrame`, so
// this cannot be a browser component test: the `render()` harness never boots
// the prefetch/claim wiring.
//
// The contract: hovering a `data-rmx-prefetch="intent"` tab warms exactly one
// fragment request through the app resolver, and the follow-up click must be
// served from that warm — no second request for the same URL. If the claim
// regresses (key mismatch, target drift, cache cleared early), the click still
// works but issues a second SSR, which is exactly the silent cost this guards.
// ---------------------------------------------------------------------------

describe('admin lists: frame prefetch', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  afterEach(async () => {
    await pool.query("DELETE FROM lists WHERE description LIKE 'test-prefetch-viewport-%'")
  })

  it('serves the clicked filter tab from the warmed response', async (t) => {
    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')

    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page
      .context()
      .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])

    await page.goto(routes.admin.lists.index.href())
    await page.locator('[data-lists-table]').waitFor({ timeout: 15_000 })

    let tab = page.getByRole('link', { name: 'Leer', exact: true })
    await tab.waitFor({ timeout: 15_000 })
    let href = await tab.getAttribute('href')
    assert.ok(href, 'the filter tab must carry an href')
    let target = new URL(href, server.baseUrl).href

    let requests = 0
    page.on('request', (request) => {
      if (request.url() === target) requests++
    })

    // The runtime starts the warm on pointer intent (100 ms); wait for its
    // response so the click is a claim rather than a race.
    let warm = page.waitForResponse(
      (response) =>
        response.url() === target && response.request().headers()['x-remix-frame'] === 'true',
      { timeout: 15_000 },
    )
    await tab.hover()
    await warm

    assert.equal(requests, 1, 'hovering the marked tab warms exactly one fragment request')

    await tab.click()
    await page.waitForURL((url) => url.searchParams.get('status') === 'empty', { timeout: 15_000 })

    assert.equal(requests, 1, 'the click must reuse the warmed response, not fetch a second SSR')
  })

  it('warms the next-page link once it scrolls into view and reuses it', async (t) => {
    let prefix = 'test-prefetch-viewport-'
    await pool.query('DELETE FROM lists WHERE description LIKE $1', [prefix + '%'])

    let now = Date.now()
    for (let index = 0; index < 11; index++) {
      await pool.query(
        `INSERT INTO lists (title, description, list, created_at, updated_at)
         VALUES ($1, $2, $3::jsonb, $4, $4)`,
        ['Prefetch ' + index, prefix + index, JSON.stringify([]), now + index],
      )
    }

    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')

    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page
      .context()
      .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])

    let nextPageRequests = 0
    let isNextPageRequest = (url: string): boolean => {
      let parsed = new URL(url)
      return (
        parsed.pathname === routes.admin.lists.index.href() &&
        parsed.searchParams.get('filter') === prefix &&
        parsed.searchParams.get('offset') === '10'
      )
    }
    page.on('request', (request) => {
      if (isNextPageRequest(request.url())) nextPageRequests++
    })

    // Attach before navigation: a pager that is already visible prefetches on
    // load, and that warm must be counted too.
    let warm = page.waitForRequest(
      (request) =>
        isNextPageRequest(request.url()) && request.headers()['x-remix-frame'] === 'true',
      { timeout: 15_000 },
    )

    await page.goto(routes.admin.lists.index.href() + '?filter=' + encodeURIComponent(prefix))
    await page.locator('[data-lists-table]').waitFor({ timeout: 15_000 })

    let next = page.getByRole('link', { name: 'Nächste Seite' })
    await next.waitFor({ timeout: 15_000 })
    await next.scrollIntoViewIfNeeded()
    await warm

    assert.equal(nextPageRequests, 1, 'the viewport pager link warms exactly one fragment request')

    await next.click()
    await page.waitForURL(
      (url) => url.searchParams.get('filter') === prefix && url.searchParams.get('offset') === '10',
      { timeout: 15_000 },
    )

    assert.equal(
      nextPageRequests,
      1,
      'the click must reuse the warmed response, not fetch a second SSR',
    )
  })
})
