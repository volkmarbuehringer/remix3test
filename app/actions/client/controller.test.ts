import * as assert from 'remix/assert'
import { describe, it, before } from 'remix/test'

import { router } from '../../test-router.ts'
import { initializeAppDatabase } from '../../db.ts'
import { createAuthCookieWithCsrf } from '../../test-utils.ts'
import { pool } from '../../data/test-pool.ts'
import { routes } from '../../routes.ts'

const BASE = 'https://remix.run'
const CLIENTS_URL = `${BASE}/admin/clients`

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
  // GET /admin/clients — page rendering
  // -----------------------------------------------------------------------
  it('GET /admin/clients returns the client page', async () => {
    let response = await router.fetch(CLIENTS_URL, {
      headers: authHeaders(),
    })

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('Client-Test'), 'page should contain Client-Test nav label')
  })

  // -----------------------------------------------------------------------
  // GET /admin/clients — grid rendering
  // -----------------------------------------------------------------------
  it('GET /admin/clients?offset=0 returns first page rows', async () => {
    let response = await router.fetch(`${CLIENTS_URL}?offset=0`, {
      headers: authHeaders(),
    })

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('client-grid-content'), 'should have grid content')
    assert.ok(html.includes('Next'), 'should have pagination')
  })

  it('renders status filter tabs and a status column', async () => {
    let response = await router.fetch(`${CLIENTS_URL}?filter=active`, {
      headers: authHeaders(),
    })

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('>Alle<') || html.includes('Alle'), 'should render Alle filter tab')
    assert.ok(html.includes('Aktiv'), 'should render Aktiv filter tab')
    assert.ok(html.includes('Inaktiv'), 'should render Inaktiv filter tab')
  })

  it('renders a per-row status toggle form', async () => {
    let response = await router.fetch(CLIENTS_URL, {
      headers: authHeaders(),
    })

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(
      html.includes('toggle-status') || html.includes('data-toggle-form'),
      'should render a server-rendered toggle form',
    )
  })

  // -----------------------------------------------------------------------
  // GET /admin/clients/edit/:rowId — edit page
  // -----------------------------------------------------------------------
  it('GET /admin/clients/edit/1 redirects to /admin/clients with editing param', async () => {
    let response = await router.fetch(`${CLIENTS_URL}/edit/1`, {
      headers: authHeaders(),
    })

    assert.equal(response.status, 302)
    let location = response.headers.get('Location') || ''
    assert.ok(location.startsWith('/admin/clients'), 'should redirect to /admin/clients')
    assert.ok(location.includes('editing=1'), 'should include editing param')
  })

  it('GET /admin/clients/edit/99999 redirects to /admin/clients', async () => {
    let response = await router.fetch(`${CLIENTS_URL}/edit/99999`, {
      headers: authHeaders(),
    })

    assert.equal(response.status, 302)
    let location = response.headers.get('Location') || ''
    assert.ok(location.startsWith('/admin/clients'), 'should redirect to /admin/clients')
  })

  // -----------------------------------------------------------------------
  // PUT /admin/clients/:id — update a row (via methodOverride with _method=PUT)
  // -----------------------------------------------------------------------
  it('PUT /admin/clients/5 updates a row and redirects', async () => {
    let body = new URLSearchParams({
      _method: 'PUT',
      name: 'Updated Name',
      email: 'updated@example.com',
      role: 'Admin',
      status: 'Active',
      registered: '2026-05-01',
      _csrf: csrfToken!,
    })
    let response = await router.fetch(`${CLIENTS_URL}/5`, {
      method: 'POST',
      body,
      redirect: 'manual',
      headers: authHeaders(),
    })

    assert.equal(response.status, 302)
    let location = response.headers.get('Location') || ''
    assert.ok(location.startsWith('/admin/clients'), 'should redirect to /admin/clients')
  })

  it('PUT /admin/clients/0 returns 400 for invalid id', async () => {
    let response = await router.fetch(`${CLIENTS_URL}/0`, {
      method: 'POST',
      body: new URLSearchParams({ _method: 'PUT', name: 'Test', _csrf: csrfToken! }),
      redirect: 'manual',
      headers: authHeaders(),
    })

    assert.equal(response.status, 400)
  })

  it('PUT /admin/clients/5 with short name re-renders with validation error', async () => {
    let body = new URLSearchParams({
      _method: 'PUT',
      name: 'Ed',
      email: 'ed@example.com',
      role: 'Editor',
      status: 'Active',
      registered: '2026-05-01',
      _csrf: csrfToken!,
    })
    let response = await router.fetch(`${CLIENTS_URL}/5`, {
      method: 'POST',
      body,
      redirect: 'manual',
      headers: authHeaders(),
    })

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('Edit Record'), 'should show edit form')
    assert.ok(html.includes('Ed'), 'should preserve submitted name value')
    assert.ok(html.includes('ed@example.com'), 'should preserve submitted email value')
  })

  // -----------------------------------------------------------------------
  // DELETE /admin/clients/:id — delete a row (via methodOverride with _method=DELETE)
  // -----------------------------------------------------------------------
  it('DELETE /admin/clients/10 deletes valid row and redirects', async () => {
    let response = await router.fetch(`${CLIENTS_URL}/10`, {
      method: 'POST',
      body: new URLSearchParams({
        _method: 'DELETE',
        _offset: '0',
        _sort: 'name',
        _order: 'asc',
        _filter: '',
        _csrf: csrfToken!,
      }),
      redirect: 'manual',
      headers: authHeaders(),
    })

    assert.equal(response.status, 302)
    let location = response.headers.get('Location') || ''
    assert.ok(location.startsWith('/admin/clients'), 'should redirect to /admin/clients')
    assert.ok(location.includes('offset=0'), 'should preserve grid offset')
    assert.ok(location.includes('sort=name'), 'should preserve grid sort')
  })

  // -----------------------------------------------------------------------
  // POST /admin/clients — create a new row (via methodOverride with _method=POST)
  // -----------------------------------------------------------------------
  it('POST /admin/clients creates a new row and redirects to editing', async () => {
    let body = new URLSearchParams({
      name: 'Created Test',
      email: 'created-test@example.com',
      role: 'Editor',
      status: 'Active',
      registered: '2026-05-01',
      _csrf: csrfToken!,
    })
    let response = await router.fetch(CLIENTS_URL, {
      method: 'POST',
      body,
      redirect: 'manual',
      headers: authHeaders(),
    })

    assert.equal(response.status, 302)
    let location = response.headers.get('Location') || ''
    assert.ok(
      location.startsWith('/admin/clients?editing='),
      'should redirect to /admin/clients?editing=<id>',
    )
    assert.ok(/\bediting=\d+/.test(location), 'editing param should be a number')
  })

  it('POST /admin/clients with empty data re-renders with validation error', async () => {
    let response = await router.fetch(CLIENTS_URL, {
      method: 'POST',
      body: new URLSearchParams({ _csrf: csrfToken! }),
      redirect: 'manual',
      headers: authHeaders(),
    })

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('New Record'), 'should re-render create form')
    assert.ok(html.includes('Create Record'), 'should show Create Record button')
  })

  it('POST /admin/clients with year 2025 re-renders with validation error', async () => {
    let body = new URLSearchParams({
      name: 'ValidNameHere',
      email: 'valid@test.com',
      registered: '2025-06-01',
      _csrf: csrfToken!,
    })
    let response = await router.fetch(CLIENTS_URL, {
      method: 'POST',
      body,
      redirect: 'manual',
      headers: authHeaders(),
    })

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('New Record'), 'should show create form')
    assert.ok(html.includes('Year must be 2026'), 'should show year validation error')
    assert.ok(html.includes('value="2025-06-01"'), 'should preserve submitted date value')
  })

  it('POST /admin/clients with short name re-renders with validation error', async () => {
    let body = new URLSearchParams({
      name: 'Bob',
      email: 'bob@test.com',
      role: 'Viewer',
      _csrf: csrfToken!,
    })
    let response = await router.fetch(CLIENTS_URL, {
      method: 'POST',
      body,
      redirect: 'manual',
      headers: authHeaders(),
    })

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('New Record'), 'should show create form')
    assert.ok(html.includes('value="Bob"'), 'should preserve submitted name value')
    assert.ok(html.includes('value="bob@test.com"'), 'should preserve submitted email value')
  })

  it('POST /admin/clients creates a new row and redirects', async () => {
    let response = await router.fetch(CLIENTS_URL, {
      method: 'POST',
      body: new URLSearchParams({
        name: 'Refresh Test',
        email: 'refresh-test@example.com',
        _csrf: csrfToken!,
      }),
      redirect: 'manual',
      headers: authHeaders(),
    })

    assert.equal(response.status, 302)
    let location = response.headers.get('Location') || ''
    assert.ok(
      location.startsWith('/admin/clients'),
      'should redirect to /admin/clients after create',
    )
  })

  // -----------------------------------------------------------------------
  // POST /admin/clients/:id/toggle-status — toggle status (PRG)
  // -----------------------------------------------------------------------
  it('POST /admin/clients/:id/toggle-status toggles status and redirects (PRG)', async () => {
    let createBody = new URLSearchParams({
      name: 'Toggle Test Client',
      email: `toggle-${Date.now()}@example.com`,
      role: 'Viewer',
      status: 'Active',
      registered: '2026-05-01',
      _csrf: csrfToken!,
    })
    let createRes = await router.fetch(CLIENTS_URL, {
      method: 'POST',
      body: createBody,
      redirect: 'manual',
      headers: authHeaders(),
    })
    assert.equal(createRes.status, 302, 'create should redirect (PRG)')
    let createLoc = createRes.headers.get('Location') || ''
    let id = Number(new URL(createLoc, BASE).searchParams.get('editing'))
    assert.ok(id > 0, 'create should return a valid client id')

    let body = new URLSearchParams({
      _csrf: csrfToken!,
      _offset: '0',
      _sort: 'name',
      _order: 'asc',
      _filter: '',
    })
    let response = await router.fetch(`${CLIENTS_URL}/${id}/toggle-status`, {
      method: 'POST',
      body,
      redirect: 'manual',
      headers: authHeaders(),
    })
    assert.equal(response.status, 302, 'toggle should redirect (PRG), not return JSON')
    let location = response.headers.get('Location') || ''
    assert.ok(location.startsWith('/admin/clients'), 'should redirect to the grid list')
    assert.ok(location.includes('sort=name'), 'should carry grid-state params')

    let result = await pool.query('SELECT status FROM clients WHERE id = $1', [id])
    assert.equal(result.rows[0]?.status, 'Inactive', 'status should flip to Inactive')
  })

  it('POST /admin/clients/:id/toggle-status redirects with a flash error for a missing client', async () => {
    let body = new URLSearchParams({
      _csrf: csrfToken!,
      _offset: '0',
      _sort: 'name',
      _order: 'asc',
      _filter: '',
    })
    let response = await router.fetch(`${CLIENTS_URL}/9999999/toggle-status`, {
      method: 'POST',
      body,
      redirect: 'manual',
      headers: authHeaders(),
    })
    assert.equal(response.status, 302, 'no JSON — PRG back to the grid')
    let location = response.headers.get('Location') || ''
    assert.ok(location.startsWith('/admin/clients'), 'should redirect to the grid list')
  })

  // -----------------------------------------------------------------------
  // Audit logging
  // -----------------------------------------------------------------------
  it('records a create audit-log entry for the clients grid', async () => {
    let email = `audit-${Date.now()}@example.com`
    let body = new URLSearchParams({
      name: 'Audit Client',
      email,
      role: 'Viewer',
      status: 'Active',
      registered: '2026-05-01',
      _csrf: csrfToken!,
    })
    let response = await router.fetch(CLIENTS_URL, {
      method: 'POST',
      body,
      redirect: 'manual',
      headers: authHeaders(),
    })
    assert.equal(response.status, 302)

    let result = await pool.query(
      `SELECT details, action_type, target_id, target_type FROM audit_logs
       WHERE target_type = 'clients'
         AND action_type = 'create'
       ORDER BY created_at DESC LIMIT 1`,
    )
    assert.ok(result.rows.length > 0, 'audit log entry must exist for client create')
    let row = result.rows[0]
    assert.equal(row.action_type, 'create')
    assert.equal(row.target_type, 'clients')
    assert.ok(row.target_id != null, 'target id should be set')
  })

  // -----------------------------------------------------------------------
  // GET /admin/clients?creating=true — create form rendering
  // -----------------------------------------------------------------------
  it('GET /admin/clients?creating=true renders the create form', async () => {
    let response = await router.fetch(`${CLIENTS_URL}?creating=true`, {
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
  it('rejects unauthenticated GET /admin/clients with 302 redirect', async () => {
    let response = await router.fetch(CLIENTS_URL)

    assert.equal(response.status, 302)
    let location = response.headers.get('Location') || ''
    assert.ok(location.startsWith(routes.auth.login.index.href()), 'should redirect to login')
  })
})
