import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../../test-router.ts'
import { initializeAppDatabase } from '../../db.ts'
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

  it('POST /admin/client creates a new row and redirects', async () => {
    let response = await router.fetch(`${BASE}/admin/client`, {
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
    assert.ok(location.startsWith('/admin/client'), 'should redirect to /admin/client')
  })

  // -----------------------------------------------------------------------
  // Grid page rendering
  // -----------------------------------------------------------------------

  it('GET /admin/client?offset=0 renders grid page with content', async () => {
    let response = await router.fetch(`${BASE}/admin/client?offset=0`, {
      headers: authHeaders(),
    })

    assert.equal(response.status, 200)
    let html = await response.text()

    assert.ok(html.includes('client-grid-content'), 'grid page should contain the grid content')
  })

  it('GET /admin/client renders the client admin page', async () => {
    let response = await router.fetch(`${BASE}/admin/client`, {
      headers: authHeaders(),
    })

    assert.equal(response.status, 200)
    let html = await response.text()

    // Page should contain the client-grid frame reference
    assert.ok(html.includes('client-grid-section'), 'client page should contain the grid section')
  })

  // -----------------------------------------------------------------------
  // Edit redirect flow
  // -----------------------------------------------------------------------

  it('GET /admin/client/edit/1 redirects to /admin/client with editing param', async () => {
    let response = await router.fetch(`${BASE}/admin/client/edit/1`, {
      headers: authHeaders(),
    })

    assert.equal(response.status, 302)
    let location = response.headers.get('Location') || ''
    assert.ok(location.startsWith('/admin/client'), 'should redirect to /admin/client')
    assert.ok(location.includes('editing=1'), 'should include editing param')
  })
})
