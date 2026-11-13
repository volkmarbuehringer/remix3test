import { describe, it, before, type TestContext } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import type { Page } from 'playwright'

import { router } from '../../../test-router.ts'
import { routes } from '../../../routes.ts'
import { createAuthCookieWithCsrfForUser } from '../../../../test/utils.ts'
import { initializeAppDatabase } from '../../../db.ts'

// ---------------------------------------------------------------------------
// /admin dashboard lazy frames — end-to-end behavior.
//
// Two layers are deferred with the runtime's built-in `loading="lazy"`:
//
// 1. The dashboard's own stats and recent-activity frames. They sit below the
//    admin page scroller's fold, so a fresh /admin render ships only their
//    reserved-height fallbacks. Scrolling "System & Aktivität" into view loads
//    each fragment exactly once and keeps it mounted afterwards.
// 2. The recent-activity fragment's per-activity user-detail frames, hidden
//    inside collapsed `<details>`. While collapsed, no user-detail route may be
//    requested; opening one loads exactly one frame.
//
// Before the lazy conversion the fragment resolved six nested frames during the
// parent render — content hidden behind a collapsed disclosure that the user
// never asked for — and the dashboard always paid for both section fragments.
//
// The runtime's own lazy-loading behavior is vendor-tested; what stays here is
// the wiring only a server proves: the real dashboard ships lazy frame hosts
// and the real fragment routes are fetched through the frame runtime.
// ---------------------------------------------------------------------------

const STATS_PATH = routes.admin.fragments.stats.href()
const RECENT_ACTIVITY_PATH = routes.admin.fragments.recentActivity.href()
const USER_DETAIL_PREFIX = routes.admin.fragments.userDetail.href({ userId: '0' }).replace(/0$/, '')
const UNREAD_COUNT_PATH = routes.notifications.unreadCount.href()

/**
 * Keeps the section frames just below the page scroller's fold, so the
 * zero-requests-before-scroll assertion is deterministic instead of depending
 * on the project's default viewport.
 */
const VIEWPORT = { width: 1280, height: 720 }

describe('admin dashboard: lazy frames', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  async function serveAdminPage(t: TestContext): Promise<Page> {
    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')

    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page
      .context()
      .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])
    await page.setViewportSize(VIEWPORT)
    return page
  }

  /** Moves the "System & Aktivität" heading to the top of the page scroller. */
  async function scrollSectionIntoView(page: Page) {
    await page
      .getByText('System & Aktivität', { exact: true })
      .first()
      .evaluate((element) => element.scrollIntoView({ block: 'start' }))
  }

  /** Moves the app's overflow container (not the window) to an edge. */
  async function scrollScroller(page: Page, position: 'top' | 'bottom') {
    await page.locator('[data-page-scroller]').evaluate((scroller, at) => {
      scroller.scrollTop = at === 'bottom' ? scroller.scrollHeight : 0
    }, position)
    // Let the runtime's observer deliver the scroll-induced callbacks.
    await page.waitForTimeout(100)
  }

  it('defers the dashboard section frames until the section is scrolled into view', async (t) => {
    let page = await serveAdminPage(t)

    let requests = { stats: 0, recentActivity: 0 }
    page.on('request', (request) => {
      let pathname = new URL(request.url()).pathname
      if (pathname === STATS_PATH) requests.stats++
      else if (pathname === RECENT_ACTIVITY_PATH) requests.recentActivity++
    })

    // The notification bell is a shell client entry that fetches the unread
    // count on mount, so its response is a real hydration signal. Without one,
    // a slow hydration would make the "no request yet" assertion vacuous.
    let shellHydrated = page.waitForResponse(
      (response) => new URL(response.url()).pathname === UNREAD_COUNT_PATH,
      { timeout: 15_000 },
    )

    await page.goto(routes.admin.index.href())
    await page.getByText('System & Aktivität', { exact: true }).first().waitFor({ timeout: 15_000 })
    await shellHydrated
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(100)

    // The premise is geometric, not incidental: if layout/font changes put the
    // fallback inside the scroller's viewport, lazy loading is *supposed* to
    // start and this test must be re-based instead of silently passing.
    let fallbackBelowFold = await page.evaluate(() => {
      let scroller = document.querySelector<HTMLElement>('[data-page-scroller]')
      let label = Array.from(document.querySelectorAll('span')).find(
        (element) => element.textContent === 'Server-Statistiken werden geladen…',
      )
      if (!scroller || !label) return false
      return label.getBoundingClientRect().top > scroller.getBoundingClientRect().bottom
    })
    assert.ok(
      fallbackBelowFold,
      'the stats fallback must start below the scroller fold for the zero-request assertion to mean deferral',
    )

    assert.equal(requests.stats, 0, 'the offscreen stats frame must not be requested')
    assert.equal(requests.recentActivity, 0, 'the offscreen activity frame must not be requested')
    assert.equal(
      await page.getByText('Server-Statistiken', { exact: true }).count(),
      0,
      'the stats fallback must stand in for the resolved content',
    )

    await scrollSectionIntoView(page)

    await page.getByText('Server-Statistiken', { exact: true }).waitFor({ timeout: 15_000 })
    await page.getByText('Letzte Aktivitäten', { exact: true }).waitFor({ timeout: 15_000 })

    assert.equal(requests.stats, 1, 'the stats frame loads exactly once')
    assert.equal(requests.recentActivity, 1, 'the activity frame loads exactly once')

    // Loaded lazy content stays mounted: more scrolling must not refetch either
    // fragment, and ancestor reloads are the only thing that may refresh them.
    await scrollScroller(page, 'bottom')
    await scrollScroller(page, 'top')
    await scrollScroller(page, 'bottom')

    assert.equal(requests.stats, 1, 'further scrolling must not refetch stats')
    assert.equal(requests.recentActivity, 1, 'further scrolling must not refetch activity')
    assert.equal(
      await page.getByText('Server-Statistiken', { exact: true }).count(),
      1,
      'the loaded stats card stays in the DOM',
    )
  })

  it('defers a user-detail frame until its disclosure is opened', async (t) => {
    let page = await serveAdminPage(t)

    let userDetailRequests = 0
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith(USER_DETAIL_PREFIX)) userDetailRequests++
    })

    await page.goto(routes.admin.index.href())

    // The recent-activity fragment is itself lazy now, so the disclosure only
    // exists after the section is scrolled into view.
    await scrollSectionIntoView(page)
    let disclosure = page.locator('details').first()
    await disclosure.waitFor({ timeout: 15_000 })

    // Collapsed: nothing requested, nothing in the DOM.
    assert.equal(userDetailRequests, 0, 'collapsed disclosures must not request user details')
    assert.equal(await page.getByText('Alice Johnson').count(), 0)

    await disclosure.locator('summary').click()
    await page.getByText('Alice Johnson').first().waitFor({ timeout: 15_000 })

    assert.equal(userDetailRequests, 1, 'opening a disclosure loads exactly one frame')

    // Retention: closing and reopening must not refetch or remount the loaded
    // frame. The built-in lazy runtime keeps content mounted after the initial
    // load; this is the user-visible contract of the disclosure widget.
    await disclosure.locator('summary').click()
    await disclosure.locator('summary').click()
    await page.getByText('Alice Johnson').first().waitFor({ timeout: 15_000 })

    assert.equal(userDetailRequests, 1, 'reopening must not refetch the mounted frame')
  })
})
