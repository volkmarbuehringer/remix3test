import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { SetCookie } from 'remix/headers'

import { router } from '../../test-router.ts'
import { createCsrfSession } from '../../test-utils.ts'
import { routes } from '../../routes.ts'

const BASE = 'https://remix.run'

// ---------------------------------------------------------------------------
// Auth Logout action integration tests
// Requires a running PostgreSQL database.
// See newapp/app/db.ts for seed data.
// ---------------------------------------------------------------------------

describe('auth-logout action', () => {
  // -----------------------------------------------------------------------
  // POST /logout
  // -----------------------------------------------------------------------
  it('POST /logout unsets session and redirects to /', async () => {
    let { cookie, csrfToken } = await createCsrfSession(`${BASE}${routes.auth.login.index.href()}`)
    let response = await router.fetch(`${BASE}${routes.auth.logout.href()}`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: new URLSearchParams({ _csrf: csrfToken }),
      redirect: 'manual',
    })

    assert.equal(response.status, 302, 'should return 302 redirect')
    assert.equal(response.headers.get('Location'), '/', 'should redirect to home')
  })

  it('POST /logout sets a new session cookie (regenerateId)', async () => {
    let { cookie, csrfToken } = await createCsrfSession(`${BASE}${routes.auth.login.index.href()}`)
    let response = await router.fetch(`${BASE}${routes.auth.logout.href()}`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: new URLSearchParams({ _csrf: csrfToken }),
      redirect: 'manual',
    })

    // Even though auth is unset, the session middleware should issue a new
    // session cookie with the regenerated ID
    let setCookie = SetCookie.from(response.headers.get('Set-Cookie'))
    assert.ok(setCookie.name, 'should set a session cookie')
    assert.equal(setCookie.name, 'session', 'set-cookie should contain session key')
  })
})
