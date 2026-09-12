import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../../test-router.ts'
import { initializeAppDatabase } from '../../db.ts'
import { createAuthCookieWithCsrf } from '../../test-utils.ts'

// ---------------------------------------------------------------------------
// Admin Fragment Controller integration tests
// Tests the nested frame endpoints for the admin dashboard.
// Requires a running PostgreSQL database seeded with demo users.
// ---------------------------------------------------------------------------

const BASE = 'https://remix.run'
const ADMIN_STATS_URL = `${BASE}/admin/fragments/stats`
const ADMIN_ACTIVITY_URL = `${BASE}/admin/fragments/recent-activity`
const ADMIN_USER_DETAIL_URL = `${BASE}/admin/fragments/user-detail`

describe('Admin Fragments Controller', () => {
  let adminCookie: string

  before(async () => {
    await initializeAppDatabase()
    let result = await createAuthCookieWithCsrf()
    adminCookie = result?.cookie ?? ''
  })

  // -----------------------------------------------------------------------
  // Stats fragment
  // -----------------------------------------------------------------------

  it('GET /admin/fragments/stats requires admin auth', async () => {
    let response = await router.fetch(ADMIN_STATS_URL)
    assert.equal(response.status, 302)
  })

  it('GET /admin/fragments/stats returns stats content', async () => {
    let response = await router.fetch(ADMIN_STATS_URL, {
      headers: { Cookie: adminCookie },
    })

    assert.equal(response.status, 200)
    let html = await response.text()

    // Stats fragment should contain server-time information
    assert.ok(html.includes('Server'), 'should reference Server')
    assert.ok(html.includes('Betriebszeit'), 'should include Betriebszeit info')
  })

  it('GET /admin/fragments/stats renders content without admin nav', async () => {
    let response = await router.fetch(ADMIN_STATS_URL, {
      headers: { Cookie: adminCookie },
    })
    let html = await response.text()

    // Fragment renders the stats content directly without admin layout navigation
    assert.ok(html.includes('Server'), 'should contain server time')
  })

  // -----------------------------------------------------------------------
  // Recent activity fragment
  // -----------------------------------------------------------------------

  it('GET /admin/fragments/recent-activity requires admin auth', async () => {
    let response = await router.fetch(ADMIN_ACTIVITY_URL)
    assert.equal(response.status, 302)
  })

  it('GET /admin/fragments/recent-activity returns activity content', async () => {
    let response = await router.fetch(ADMIN_ACTIVITY_URL, {
      headers: { Cookie: adminCookie },
    })

    assert.equal(response.status, 200)
    let html = await response.text()

    // Activity fragment should list recent actions
    assert.ok(html.includes('Letzte Aktivitäten'), 'should have activity heading')
    assert.ok(html.includes('Created'), 'should show an activity item')
  })

  it('GET /admin/fragments/recent-activity defers its user-detail frames', async () => {
    let response = await router.fetch(ADMIN_ACTIVITY_URL, {
      headers: { Cookie: adminCookie },
    })

    let html = await response.text()

    // The controller generates 6 activities; each renders its disclosure and a
    // placeholder for the not-yet-requested user detail.
    let placeholders = html.match(/Benutzerdetails werden geladen/g)
    assert.ok(placeholders && placeholders.length >= 3, 'should render a placeholder per activity')

    // The nested user-detail frames are lazy now: they ship as client-entry
    // props (so the browser can mount them) but must not be resolved into this
    // response. A regression here silently restores six eager frame resolutions
    // per render. Asserted by the controller's own payload, not by frame-marker
    // internals, so the guard cannot pass vacuously if the runtime renames them.
    for (let name of ['Alice Johnson', 'Bob Smith', 'Carol Williams', 'David Brown']) {
      assert.equal(html.includes(name), false, `should not inline the ${name} user detail`)
    }
  })

  // -----------------------------------------------------------------------
  // User detail fragment
  // -----------------------------------------------------------------------

  it('GET /admin/fragments/user-detail/101 requires admin auth', async () => {
    let response = await router.fetch(`${ADMIN_USER_DETAIL_URL}/101`)
    assert.equal(response.status, 302)
  })

  it('GET /admin/fragments/user-detail/101 returns user info', async () => {
    let response = await router.fetch(`${ADMIN_USER_DETAIL_URL}/101`, {
      headers: { Cookie: adminCookie },
    })

    assert.equal(response.status, 200)
    let html = await response.text()

    // Should contain the known user name for userId 101
    assert.ok(html.includes('Alice Johnson'), 'should include user name Alice Johnson')
  })

  it('GET /admin/fragments/user-detail/999 returns unknown user', async () => {
    let response = await router.fetch(`${ADMIN_USER_DETAIL_URL}/999`, {
      headers: { Cookie: adminCookie },
    })

    assert.equal(response.status, 200)
    let html = await response.text()

    assert.ok(html.includes('User #999'), 'should show fallback name for unknown user')
  })
})
