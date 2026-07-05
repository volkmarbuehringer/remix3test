import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { db, initializeAppDatabase } from '../../../data/setup.ts'
import { sql } from 'remix/data-table'
import { router } from '../../../test-router.ts'
import { createAuthCookieWithCsrf, createAuthCookieWithCsrfForUser } from '../../../test-utils.ts'
import { routes } from '../../../routes.ts'

const BASE = 'https://remix.run'
const SUPPORT_URL = `${BASE}/admin/support`

describe('Admin Support controller', () => {
  let adminCookie: string
  let userCookie: string

  before(async () => {
    await initializeAppDatabase()

    await db.exec(sql`DELETE FROM chatlog WHERE user_id IN (SELECT id FROM users WHERE email IN ('admin@newapp.com', 'user@newapp.com'))`)

    let adminResult = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    adminCookie = adminResult?.cookie ?? ''

    let userResult = await createAuthCookieWithCsrfForUser('user@newapp.com')
    userCookie = userResult?.cookie ?? ''
  })

  it('GET /admin/support redirects to login when not authenticated', async () => {
    let response = await router.fetch(SUPPORT_URL)
    assert.equal(response.status, 302)
    let location = response.headers.get('Location')
    assert.ok(location?.startsWith(routes.auth.login.index.href()), 'should redirect to login with returnTo')
    assert.ok(location?.includes('returnTo='), 'should capture return path')
  })

  it('GET /admin/support returns 200 for admin', async () => {
    let response = await router.fetch(SUPPORT_URL, {
      headers: { Cookie: adminCookie },
    })
    assert.equal(response.status, 200)
  })

  it('GET /admin/support returns 403 for non-admin user', async () => {
    let response = await router.fetch(SUPPORT_URL, {
      headers: { Cookie: userCookie },
    })
    assert.equal(response.status, 403)
  })

  it('GET /admin/support includes support page content', async () => {
    let response = await router.fetch(SUPPORT_URL, {
      headers: { Cookie: adminCookie },
    })
    let text = await response.text()
    assert.ok(text.includes('Support'), 'response should mention Support')
  })

  it('GET /admin/support with invalid agentId query string is ignored gracefully', async () => {
    let response = await router.fetch(`${SUPPORT_URL}?agentId=<script>`, {
      headers: { Cookie: adminCookie },
    })
    assert.equal(response.status, 200)
    let text = await response.text()
    assert.ok(text.includes('Support'), 'page should still render')
  })

  it('POST /admin/support with empty message returns 400', async () => {
    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    let response = await router.fetch(SUPPORT_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: new URLSearchParams({ message: '', _csrf: session.csrfToken }),
      redirect: 'manual',
    })

    assert.equal(response.status, 400)
    let json = await response.json() as { error?: string }
    assert.ok(json.error, 'response should include an error message')
  })

  it('POST /admin/support with whitespace-only message returns 400', async () => {
    // Wait for rate limit window to clear from previous POST
    await new Promise(r => setTimeout(r, 2100))

    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    let response = await router.fetch(SUPPORT_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: new URLSearchParams({ message: '   ', _csrf: session.csrfToken }),
      redirect: 'manual',
    })

    assert.equal(response.status, 400)
    let json = await response.json() as { error?: string }
    assert.ok(json.error, 'response should include an error message')
  })

  it('POST /admin/support by non-admin user returns 403', async () => {
    let userSession = await createAuthCookieWithCsrfForUser('user@newapp.com')
    assert.ok(userSession?.cookie, 'Failed to create auth session')

    let response = await router.fetch(SUPPORT_URL, {
      method: 'POST',
      headers: { Cookie: userSession.cookie },
      body: new URLSearchParams({ message: 'test', _csrf: userSession.csrfToken }),
      redirect: 'manual',
    })

    assert.equal(response.status, 403)
  })

  it('POST /admin/support triggers rate limit on rapid requests', async () => {
    // Fire two POSTs from the same admin session in quick succession.
    // First consumes the rate limit token; second is rejected as 429.
    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    // First POST uses a valid message to hit the rate limiter (validation runs before throttle per M2)
    await router.fetch(SUPPORT_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: new URLSearchParams({ message: 'first request', _csrf: session.csrfToken }),
      redirect: 'manual',
    })

    let second = await router.fetch(SUPPORT_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: new URLSearchParams({ message: 'another', _csrf: session.csrfToken }),
      redirect: 'manual',
    })

    assert.equal(second.status, 429)
    let json = await second.json() as { error?: string }
    assert.ok(json.error, '429 response should include an error message')
  })
})
