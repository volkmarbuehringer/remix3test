import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../test-router.ts'
import { routes } from '../../routes.ts'
import { createAuthCookieWithCsrfForUser } from '../../../test/utils.ts'
import { initializeAppDatabase } from '../../db.ts'

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
})
