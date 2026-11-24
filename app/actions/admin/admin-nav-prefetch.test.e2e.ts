import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../test-router.ts'
import { routes, frames } from '../../routes.ts'
import { createAuthCookieWithCsrfForUser } from '../../../test/utils.ts'
import { initializeAppDatabase } from '../../db.ts'

// ---------------------------------------------------------------------------
// Admin sidebar — frame prefetch end-to-end.
//
// The sidebar links are frame navigations, so they opt into
// `data-rmx-prefetch="intent"` (and skip it for document links and the active
// item). Only the real client runtime (`run({ prefetch })`) starts the
// listeners, so this cannot be a component test.
//
// Measurement: hovering a section link warms exactly one fragment request
// through the app resolver, and the click must be served from that warm — a
// second request means the claim regressed (key/target drift, cache cleared
// early) and the prefetch is paying an SSR cost with no navigation benefit.
// ---------------------------------------------------------------------------

describe('admin sidebar: frame prefetch', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  it('serves a clicked section link from the hover warm', async (t) => {
    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')

    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page
      .context()
      .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])

    await page.goto(routes.admin.index.href())
    let link = page
      .locator('#sidebar-shell-nav')
      .getByRole('link', { name: 'Benutzer', exact: true })
    await link.waitFor({ timeout: 15_000 })

    assert.equal(await link.getAttribute('data-rmx-prefetch'), 'intent')
    assert.equal(await link.getAttribute('data-rmx-target'), frames.adminContent)

    let active = page
      .locator('#sidebar-shell-nav')
      .getByRole('link', { name: 'Dashboard', exact: true })
    assert.equal(await active.getAttribute('data-rmx-prefetch'), null)

    let target = new URL(routes.admin.users.index.href(), server.baseUrl).href
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
    await link.hover()
    await warm

    assert.equal(requests, 1, 'hovering the marked sidebar link warms exactly one fragment request')

    await link.click()
    await page.waitForURL((url) => url.pathname === routes.admin.users.index.href(), {
      timeout: 15_000,
    })

    assert.equal(requests, 1, 'the click must reuse the warmed response, not fetch a second SSR')
  })
})
