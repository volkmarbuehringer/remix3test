import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../test-router.ts'
import { initializeAppDatabase } from '../../db.ts'
import { createAuthCookieWithCsrfForUser } from '../../test-utils.ts'

// ---------------------------------------------------------------------------
// /appointments/new period/status frame navigation (client e2e).
//
// The period/status segmented controls are plain links targeting the blocking
// `appointments-new-content` frame. The server tests assert the shell/fragment
// split and the `data-rmx-target` attributes; only a browser can verify that
// clicking a segment swaps the frame in place — the URL updates, no full
// document reload happens, and the active segment follows the new URL.
// ---------------------------------------------------------------------------

describe('appointments-new frame navigation', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  it('reloads the frame in place when a period segment is clicked', async (t) => {
    let auth = await createAuthCookieWithCsrfForUser('user@newapp.com')
    assert.ok(auth?.cookie, 'user session must be created')

    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page
      .context()
      .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])

    // A full document navigation fires `load`; a same-document frame swap does
    // not. Counting loads is how the test tells the two apart.
    let loads = 0
    page.on('load', () => {
      loads++
    })

    // Frames are registered synchronously during hydration (createSubFrames runs
    // before scheduleHydrationMarker), so the NotificationBell's unread-count
    // fetch is a safe "the runtime hydrated and the named frame exists" signal.
    let hydrated = page.waitForResponse(
      (response) => response.url().includes('/notifications/unread-count'),
      { timeout: 15_000 },
    )
    await page.goto('/appointments/new')
    await hydrated

    let nextWeek = page.locator('a[data-rmx-target="appointments-new-content"]', {
      hasText: 'Nächste Woche',
    })
    await nextWeek.waitFor({ timeout: 15_000 })

    await nextWeek.click()
    await page.waitForFunction(() => location.search.includes('period=next-week'), undefined, {
      timeout: 15_000,
    })

    // The re-rendered fragment marks the new period current.
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('a[data-rmx-target="appointments-new-content"]')].some(
          (anchor) =>
            anchor.getAttribute('aria-current') === 'true' &&
            (anchor.textContent ?? '').includes('Nächste Woche'),
        ),
      undefined,
      { timeout: 15_000 },
    )

    assert.equal(loads, 1, 'the segment must reload the frame, not the whole document')
  })
})
