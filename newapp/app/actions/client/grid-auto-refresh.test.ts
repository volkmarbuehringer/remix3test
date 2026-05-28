import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../../router.ts'
import { initializeAppDatabase } from '../../data/setup.ts'
import { createAuthCookieWithCsrf } from '../../test-utils.ts'

// ---------------------------------------------------------------------------
// Client Grid integration tests
// Verifies the CRUD redirect flow and grid page rendering with Frame refresh.
// Requires a running PostgreSQL database seeded with demo users.
// ---------------------------------------------------------------------------

const BASE = 'https://remix.run'

describe('Client Grid', () => {
  let authCookie: string | null
  let csrfToken: string | null

  before(async () => {
    await initializeAppDatabase()
    let result = await createAuthCookieWithCsrf()
    authCookie = result?.cookie ?? null
    csrfToken = result?.csrfToken ?? null
    assert.ok(authCookie, 'should create an auth session for tests')
  })

  function authHeaders(): Record<string, string> {
    return authCookie ? { Cookie: authCookie } : {}
  }

  // -----------------------------------------------------------------------
  // CRUD redirect flow
  // -----------------------------------------------------------------------

  it('POST /client creates a new row and redirects', async () => {
    let response = await router.fetch(`${BASE}/client`, {
      method: 'POST',
      body: new URLSearchParams({
        name: 'Test User',
        email: 'test-create@example.com',
        role: 'Editor',
        status: 'Active',
        registered: '2026-05-01',
        _csrf: csrfToken ?? '',
      }),
      redirect: 'manual',
      headers: authHeaders(),
    })

    assert.equal(response.status, 302)
    let location = response.headers.get('Location') || ''
    assert.ok(location.startsWith('/client'), 'should redirect to /client')
  })

  // -----------------------------------------------------------------------
  // Grid page rendering
  // -----------------------------------------------------------------------

  it('GET /client/grid?offset=0 renders grid page with content', async () => {
    let response = await router.fetch(`${BASE}/client/grid?offset=0`, {
      headers: authHeaders(),
    })

    assert.equal(response.status, 200)
    let html = await response.text()

    // Grid page should include the client-grid marker
    assert.ok(
      html.includes('client-grid'),
      'grid page should reference the client-grid frame',
    )
  })

  it('GET /client renders the client lab page', async () => {
    let response = await router.fetch(`${BASE}/client`, {
      headers: authHeaders(),
    })

    assert.equal(response.status, 200)
    let html = await response.text()

    // Page should contain the client-grid frame reference
    assert.ok(
      html.includes('client-grid'),
      'client page should reference the client-grid frame',
    )
  })

  // -----------------------------------------------------------------------
  // Edit redirect flow
  // -----------------------------------------------------------------------

  it('GET /client/edit/1 redirects to /client with editing param', async () => {
    let response = await router.fetch(`${BASE}/client/edit/1`, {
      headers: authHeaders(),
    })

    assert.equal(response.status, 302)
    let location = response.headers.get('Location') || ''
    assert.ok(location.startsWith('/client'), 'should redirect to /client')
    assert.ok(location.includes('editing=1'), 'should include editing param')
  })
})
