import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../test-router.ts'
import { routes } from '../../routes.ts'
import { createAuthCookieWithCsrfForUser } from '../../../test/utils.ts'
import { initializeAppDatabase } from '../../db.ts'

// ---------------------------------------------------------------------------
// /admin/clients pager — viewport prefetch end-to-end.
//
// This is a separate pager implementation from /admin/lists
// (`app/actions/client/grid-page.tsx`), so the real runtime is exercised here
// as well: the next-page link warms once when it scrolls into view, and the
// click claims that warm instead of paying for a second SSR.
// ---------------------------------------------------------------------------

describe('admin clients: frame prefetch', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  it('warms the next-page link once it scrolls into view and reuses it', async (t) => {
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
        parsed.pathname === routes.admin.clients.index.href() &&
        parsed.searchParams.get('offset') === '15'
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

    await page.goto(routes.admin.clients.index.href())
    await page.locator('[data-clients-table]').waitFor({ timeout: 15_000 })

    let next = page.getByRole('link', { name: /^Weiter/ })
    await next.waitFor({ timeout: 15_000 })
    await next.scrollIntoViewIfNeeded()
    await warm

    assert.equal(nextPageRequests, 1, 'the viewport pager link warms exactly one fragment request')

    await next.click()
    await page.waitForURL((url) => url.searchParams.get('offset') === '15', { timeout: 15_000 })

    assert.equal(
      nextPageRequests,
      1,
      'the click must reuse the warmed response, not fetch a second SSR',
    )
  })
})
