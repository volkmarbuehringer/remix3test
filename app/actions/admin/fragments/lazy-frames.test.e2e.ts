import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../../test-router.ts'
import { routes } from '../../../routes.ts'
import { createAuthCookieWithCsrfForUser } from '../../../../test/utils.ts'
import { initializeAppDatabase } from '../../../db.ts'

// ---------------------------------------------------------------------------
// /admin dashboard lazy user-detail frames — end-to-end behavior.
//
// The recent-activity fragment renders one `<details>` disclosure per activity,
// each hiding a user-detail frame. Those frames use the runtime's built-in
// `loading="lazy"`: while the disclosures are collapsed, no user-detail route
// may be requested at all, and opening one must load exactly one frame.
//
// Before the lazy conversion this fragment resolved six nested frames during
// the parent render — content hidden behind a collapsed disclosure that the
// user never asked for.
//
// The runtime's own lazy-loading behavior is vendor-tested; what stays here is
// the wiring only a server proves: the real dashboard fragment ships lazy
// frame hosts and the real /admin/fragments/user-detail route is fetched
// through the frame runtime.
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

    // Retention: closing and reopening must not refetch or remount the loaded
    // frame. The built-in lazy runtime keeps content mounted after the initial
    // load; this is the user-visible contract of the disclosure widget.
    await disclosure.locator('summary').click()
    await disclosure.locator('summary').click()
    await page.getByText('Alice Johnson').first().waitFor({ timeout: 15_000 })

    assert.equal(userDetailRequests, 1, 'reopening must not refetch the mounted frame')
  })
})
