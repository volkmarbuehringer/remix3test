import * as assert from 'remix/assert'
import { describe, it, before } from 'remix/test'

import { router } from '../../router.ts'
import { initializeAppDatabase } from '../../data/setup.ts'
import { createAuthCookieWithCsrf } from '../../test-utils.ts'

describe('Client lab controller', () => {
  let authCookie: string | null
  let csrfToken: string | null

  before(async () => {
    await initializeAppDatabase()
    let result = await createAuthCookieWithCsrf()
    authCookie = result?.cookie ?? null
    csrfToken = result?.csrfToken ?? null
    assert.ok(authCookie, 'login should set a session cookie for tests')
  })

  function authHeaders(): Record<string, string> {
    return authCookie ? { Cookie: authCookie } : {}
  }

  // -----------------------------------------------------------------------
  // GET /client — page rendering
  // -----------------------------------------------------------------------
  it('GET /client returns the client lab page', async () => {
    let response = await router.fetch('https://remix.run/client', {
      headers: authHeaders(),
    })

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(
      html.includes('>Client</'),
      'page should contain Client heading',
    )
  })

  // -----------------------------------------------------------------------
  // GET /client/grid — Frame fragment rendering
  // -----------------------------------------------------------------------
  it('GET /client/grid?offset=0 returns first page rows', async () => {
    let response = await router.fetch('https://remix.run/client/grid?offset=0', {
      headers: authHeaders(),
    })

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('client-grid-content'), 'should have grid content')
    assert.ok(html.includes('data-pagination') || html.includes('Next'), 'should have pagination')
  })

  // -----------------------------------------------------------------------
  // GET /client/edit/:rowId — edit page
  // -----------------------------------------------------------------------
  it('GET /client/edit/1 redirects to /client with editing param', async () => {
    let response = await router.fetch('https://remix.run/client/edit/1', {
      headers: authHeaders(),
    })

    assert.equal(response.status, 302)
    let location = response.headers.get('Location') || ''
    assert.ok(location.startsWith('/client'), 'should redirect to /client')
    assert.ok(location.includes('editing=1'), 'should include editing param')
  })

  it('GET /client/edit/99999 redirects to /client', async () => {
    let response = await router.fetch('https://remix.run/client/edit/99999', {
      headers: authHeaders(),
    })

    assert.equal(response.status, 302)
    let location = response.headers.get('Location') || ''
    assert.ok(location.startsWith('/client'), 'should redirect to /client')
  })

  // -----------------------------------------------------------------------
  // PUT /client/:id — update a row (via methodOverride with _method=PUT)
  // -----------------------------------------------------------------------
  it('PUT /client/5 updates a row and redirects', async () => {
    let body = new URLSearchParams({
      _method: 'PUT',
      name: 'Updated Name',
      email: 'updated@example.com',
      role: 'Admin',
      status: 'Active',
      registered: '2026-05-01',
      _csrf: csrfToken!,
    })
    let response = await router.fetch('https://remix.run/client/5', {
      method: 'POST',
      body,
      redirect: 'manual',
      headers: authHeaders(),
    })

    // Should redirect
    assert.equal(response.status, 302)
    let location = response.headers.get('Location') || ''
    assert.ok(location.startsWith('/client'), 'should redirect to /client')
  })

  it('PUT /client/0 returns 400 for invalid id', async () => {
    let response = await router.fetch('https://remix.run/client/0', {
      method: 'POST',
      body: new URLSearchParams({ _method: 'PUT', name: 'Test', _csrf: csrfToken! }),
      redirect: 'manual',
      headers: authHeaders(),
    })

    assert.equal(response.status, 400)
  })

  it('PUT /client/5 with short name returns 400 with validation error', async () => {
    let body = new URLSearchParams({
      _method: 'PUT',
      name: 'Ed',
      email: 'ed@example.com',
      role: 'Editor',
      status: 'Active',
      registered: '2026-05-01',
      _csrf: csrfToken!,
    })
    let response = await router.fetch('https://remix.run/client/5', {
      method: 'POST',
      body,
      redirect: 'manual',
      headers: authHeaders(),
    })

    assert.equal(response.status, 400)
    let html = await response.text()
    assert.ok(html.includes('Edit Record'), 'should show edit form')
    assert.ok(html.includes('Ed'), 'should preserve submitted name value')
    assert.ok(html.includes('ed@example.com'), 'should preserve submitted email value')
  })

  // -----------------------------------------------------------------------
  // DELETE /client/:id — delete a row (via methodOverride with _method=DELETE)
  // -----------------------------------------------------------------------
  it('DELETE /client/10 deletes valid row and redirects', async () => {
    let response = await router.fetch('https://remix.run/client/10', {
      method: 'POST',
      body: new URLSearchParams({ _method: 'DELETE', _offset: '0', _csrf: csrfToken! }),
      redirect: 'manual',
      headers: authHeaders(),
    })

    assert.equal(response.status, 302)
    let location = response.headers.get('Location') || ''
    assert.ok(location.startsWith('/client'), 'should redirect to /client')
  })

  // -----------------------------------------------------------------------
  // POST /client — create a new row (via methodOverride with _method=POST)
  // -----------------------------------------------------------------------
  it('POST /client creates a new row and redirects to editing', async () => {
    let body = new URLSearchParams({
      name: 'Created Test',
      email: 'created-test@example.com',
      role: 'Editor',
      status: 'Active',
      registered: '2026-05-01',
      _csrf: csrfToken!,
    })
    let response = await router.fetch('https://remix.run/client', {
      method: 'POST',
      body,
      redirect: 'manual',
      headers: authHeaders(),
    })

    assert.equal(response.status, 302)
    let location = response.headers.get('Location') || ''
    assert.ok(location.startsWith('/client?editing='), 'should redirect to /client?editing=<id>')
    assert.ok(/\bediting=\d+/.test(location), 'editing param should be a number')
  })

  it('POST /client with empty data returns 400 with validation error', async () => {
    let response = await router.fetch('https://remix.run/client', {
      method: 'POST',
      body: new URLSearchParams({ _csrf: csrfToken! }),
      redirect: 'manual',
      headers: authHeaders(),
    })

    assert.equal(response.status, 400)
    let html = await response.text()
    assert.ok(html.includes('New Record'), 'should re-render create form')
    assert.ok(html.includes('Create Record'), 'should show Create Record button')
  })

  it('POST /client with year 2025 returns 400 with validation error', async () => {
    let body = new URLSearchParams({
      name: 'ValidNameHere',
      email: 'valid@test.com',
      registered: '2025-06-01',
      _csrf: csrfToken!,
    })
    let response = await router.fetch('https://remix.run/client', {
      method: 'POST',
      body,
      redirect: 'manual',
      headers: authHeaders(),
    })

    assert.equal(response.status, 400)
    let html = await response.text()
    assert.ok(html.includes('New Record'), 'should show create form')
    assert.ok(html.includes('Year must be 2026'), 'should show year validation error')
    assert.ok(html.includes('value="2025-06-01"'), 'should preserve submitted date value')
  })

  it('POST /client with short name returns 400 with field error', async () => {
    let body = new URLSearchParams({
      name: 'Bob',
      email: 'bob@test.com',
      role: 'Viewer',
      _csrf: csrfToken!,
    })
    let response = await router.fetch('https://remix.run/client', {
      method: 'POST',
      body,
      redirect: 'manual',
      headers: authHeaders(),
    })

    assert.equal(response.status, 400)
    let html = await response.text()
    assert.ok(html.includes('New Record'), 'should show create form')
    assert.ok(html.includes('value="Bob"'), 'should preserve submitted name value')
    assert.ok(html.includes('value="bob@test.com"'), 'should preserve submitted email value')
  })

  it('POST /client creates a new row and redirects', async () => {
    let response = await router.fetch('https://remix.run/client', {
      method: 'POST',
      body: new URLSearchParams({ name: 'Refresh Test', email: 'refresh-test@example.com', _csrf: csrfToken! }),
      redirect: 'manual',
      headers: authHeaders(),
    })

    assert.equal(response.status, 302)
    let location = response.headers.get('Location') || ''
    assert.ok(location.startsWith('/client'), 'should redirect to /client after create')
  })

  // -----------------------------------------------------------------------
  // GET /client?creating=true — create form rendering
  // -----------------------------------------------------------------------
  it('GET /client?creating=true renders the create form', async () => {
    let response = await router.fetch('https://remix.run/client?creating=true', {
      headers: authHeaders(),
    })

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('New Record'), 'should show New Record heading')
    assert.ok(html.includes('Create Record'), 'should show Create Record button')
  })

  // -----------------------------------------------------------------------
  // Unauthenticated access is rejected with redirect
  // -----------------------------------------------------------------------
  it('rejects unauthenticated GET /client with 302 redirect', async () => {
    let response = await router.fetch('https://remix.run/client')

    assert.equal(response.status, 302)
    let location = response.headers.get('Location') || ''
    assert.ok(location.startsWith('/login'), 'should redirect to /login')
  })
})
