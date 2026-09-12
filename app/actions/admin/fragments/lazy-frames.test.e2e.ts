import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../../test-router.ts'
import { routes } from '../../../routes.ts'
import { createAuthCookieWithCsrfForUser } from '../../../test-utils.ts'
import { initializeAppDatabase } from '../../../db.ts'

// ---------------------------------------------------------------------------
// /admin dashboard lazy user-detail frames — end-to-end behavior.
//
// The recent-activity fragment renders one `<details>` disclosure per activity,
// each hiding a user-detail frame. Those frames are lazy (LazyFrame): while the
// disclosures are collapsed, no user-detail route may be requested at all, and
// opening one must load exactly one frame.
//
// Before the lazy conversion this fragment resolved six nested frames during
// the parent render — content hidden behind a collapsed disclosure that the
// user never asked for.
// ---------------------------------------------------------------------------

const USER_DETAIL_PREFIX = '/admin/fragments/user-detail/'

describe('admin dashboard: lazy user-detail frames', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  it('defers a user-detail frame until its disclosure is opened', async (t) => {
    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')

    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page
      .context()
      .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])

    let userDetailRequests = 0
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith(USER_DETAIL_PREFIX)) userDetailRequests++
    })

    await page.goto(routes.admin.index.href())

    // A full-page GET renders the admin-content frame, which then fetches the
    // dashboard fragment. Wait for the disclosure that fragment contains.
    let disclosure = page.locator('details').first()
    await disclosure.waitFor({ timeout: 15_000 })

    // Collapsed: nothing requested, nothing in the DOM.
    assert.equal(userDetailRequests, 0, 'collapsed disclosures must not request user details')
    assert.equal(await page.getByText('Alice Johnson').count(), 0)

    await disclosure.locator('summary').click()
    await page.getByText('Alice Johnson').first().waitFor({ timeout: 15_000 })

    assert.equal(userDetailRequests, 1, 'opening a disclosure loads exactly one frame')

    // Retention: a mounted frame survives the disclosure closing, so reopening
    // it must neither re-request it nor lose the loaded content.
    await disclosure.locator('summary').click()
    await page.waitForFunction(() => document.querySelector('details')?.open === false, undefined, {
      timeout: 15_000,
    })
    assert.equal(
      await page.getByText('Alice Johnson').count(),
      1,
      'content stays mounted collapsed',
    )

    await disclosure.locator('summary').click()
    await page.getByText('Alice Johnson').first().waitFor({ timeout: 15_000 })

    assert.equal(userDetailRequests, 1, 'reopening a disclosure must not refetch the frame')
  })
})
