import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../test-router.ts'
import { routes } from '../../routes.ts'
import { createAuthCookieWithCsrfForUser } from '../../../test/utils.ts'

describe('home: mobile navigation', () => {
  it('opens the drawer from the hamburger button', async (t) => {
    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(routes.home.href())

    let toggle = page.locator('#nav-toggle')
    await page.locator('#nav-toggle[data-nav-toggle-ready]').waitFor({ timeout: 15_000 })
    await toggle.click()
    await page.locator('#nav-drawer.is-open').waitFor({ timeout: 5_000 })

    assert.equal(await toggle.getAttribute('aria-expanded'), 'true')
    let drawer = await page.locator('#nav-drawer').evaluate((element) => ({
      display: getComputedStyle(element).display,
      rect: element.getBoundingClientRect().toJSON(),
    }))
    assert.equal(drawer.display, 'flex', 'drawer must become visible')
    assert.ok(drawer.rect.width > 0, 'drawer must have a visible width')
    // Regression: a position: fixed drawer nested inside the sticky header used
    // the header's backdrop-filter as its containing block and was clamped to
    // the ~60px header height, so the menu appeared not to open.
    assert.ok(drawer.rect.height >= 700, 'drawer must cover the viewport, not just the header')
  })

  it('opens the drawer after a client-side navigation to home', async (t) => {
    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(routes.auth.login.index.href())

    await page.locator('header a[href="/"]').first().click()
    // Wait for the home URL and the home hero, not just any `main h1`: the
    // login page has an h1 too, so a generic wait resolved before the
    // navigation finished and the test clicked the login page's toggle while
    // the home document was replacing it.
    await page.waitForURL((url) => url.pathname === routes.home.href(), { timeout: 15_000 })
    await page
      .locator('main h1')
      .filter({ hasText: 'Verwaltung' })
      .first()
      .waitFor({ timeout: 15_000 })

    let toggle = page.locator('#nav-toggle')
    // Wait for the client entry to attach its listener; clicking during
    // hydration is a silent no-op and made this test flaky.
    await page.locator('#nav-toggle[data-nav-toggle-ready]').waitFor({ timeout: 15_000 })
    await toggle.click()
    await page.locator('#nav-drawer.is-open').waitFor({ timeout: 5_000 })
    await page.locator('#nav-toggle[aria-expanded="true"]').waitFor({ timeout: 5_000 })
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true')
  })

  it('opens the drawer for a signed-in user', async (t) => {
    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')

    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page
      .context()
      .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(routes.home.href())

    let toggle = page.locator('#nav-toggle')
    await page.locator('#nav-toggle[data-nav-toggle-ready]').waitFor({ timeout: 15_000 })
    await toggle.click()
    await page.locator('#nav-drawer.is-open').waitFor({ timeout: 5_000 })
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true')
  })
})
