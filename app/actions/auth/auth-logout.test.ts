import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../../test-router.ts'
import { createCsrfSession, extractCookie } from '../../../test/utils.ts'
import { readSessionId } from '../../middleware/session.ts'
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

    assert.equal(response.status, 303, 'should return 303 redirect')
    assert.equal(response.headers.get('Location'), '/', 'should redirect to home')
  })

  it('POST /logout rotates the session id (regenerateId)', async () => {
    let { cookie, csrfToken } = await createCsrfSession(`${BASE}${routes.auth.login.index.href()}`)
    let before = await readSessionId(cookie)
    assert.ok(before, 'precondition: the GET should have issued a session id')

    let response = await router.fetch(`${BASE}${routes.auth.logout.href()}`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: new URLSearchParams({ _csrf: csrfToken }),
      redirect: 'manual',
    })

    // Logout must rotate, not only unset one identity field: a new session id
    // is issued and the old one is marked for deletion when the session saves.
    let after = await readSessionId(extractCookie(response))
    assert.ok(after, 'should set a new session cookie')
    assert.notEqual(after, before, 'logout must issue a different session id')
  })
})
