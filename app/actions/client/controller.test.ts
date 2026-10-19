import * as assert from 'remix/assert'
import { describe, it, before } from 'remix/test'

import { router } from '../../test-router.ts'
import { db, initializeAppDatabase } from '../../db.ts'
import { createAuthCookieWithCsrf } from '../../../test/utils.ts'
import { pool } from '../../../test/pool.ts'
import { routes } from '../../routes.ts'
import { seed } from '../../data/seed.ts'
import { clientErrorMap } from './controller.tsx'

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
  // Validation copy
  // -----------------------------------------------------------------------
  it('maps check messages by issue code and field, not vendor text', () => {
    let context = (code: string, field: string) => ({
      code,
      defaultMessage: 'Vendor copy is allowed to change',
      path: [field],
      input: '',
    })

    assert.equal(
      clientErrorMap(context('string.min_length', 'name')),
      'Der Name muss mindestens 8 Zeichen enthalten.',
    )
    assert.equal(
      clientErrorMap(context('string.max_length', 'name')),
      'Der Name darf höchstens 100 Zeichen enthalten.',
    )
    assert.equal(
      clientErrorMap(context('string.max_length', 'email')),
      'Die E-Mail-Adresse darf höchstens 100 Zeichen enthalten.',
    )
    assert.equal(
      clientErrorMap(context('string.email', 'email')),
      'Bitte eine gültige E-Mail-Adresse eingeben.',
    )
    assert.equal(clientErrorMap(context('enum.invalid_value', 'role')), 'Ungültige Rolle.')
    assert.equal(clientErrorMap(context('enum.invalid_value', 'status')), 'Ungültiger Status.')
    assert.equal(
      clientErrorMap(context('string.min_length', 'email')),
      undefined,
      'an unrelated field/code pair keeps the vendor default',
    )
  })

  it('seeds every client with a registration date inside 2026', async () => {
    let result = await pool.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE registered < $1 OR registered >= $2)::int AS outside,
              COUNT(*) FILTER (WHERE char_length(name) < 8)::int AS short_names
         FROM clients
        WHERE email LIKE 'user%@example.com'`,
      [Date.UTC(2026, 0, 1), Date.UTC(2027, 0, 1)],
    )
    let row = result.rows[0]!
    assert.ok(Number(row.total) > 0, 'the client seed should have run')
    assert.equal(
      Number(row.outside),
      0,
      'all seeded clients must be editable under the 2026 registration rule',
    )
    assert.equal(
      Number(row.short_names),
      0,
      'all seeded clients must satisfy the 8-character name rule',
    )
  })

  it('normalizes legacy demo client names and dates when the seed runs', async () => {
    // Use a high index so the date arithmetic exercises the bigint path; the
    // old int4 expression overflowed for indexes above ~24.
    let existing = await pool.query('SELECT name, registered FROM clients WHERE id = 150')
    let row = existing.rows[0]!
    await pool.query('UPDATE clients SET name = $1, registered = $2 WHERE id = 150', [
      'User 50',
      Date.UTC(2025, 0, 21),
    ])

    try {
      await seed(db)
      let result = await pool.query('SELECT name, registered FROM clients WHERE id = 150')
      let normalized = result.rows[0]!
      assert.equal(normalized.name, 'User 050')
      let registered = Number(normalized.registered)
      assert.ok(
        registered >= Date.UTC(2026, 0, 1) && registered < Date.UTC(2027, 0, 1),
        'legacy seeded dates should be normalized into 2026',
      )
    } finally {
      await pool.query('UPDATE clients SET name = $1, registered = $2 WHERE id = 150', [
        row.name,
        row.registered,
      ])
    }
  })

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
    assert.ok(html.includes('Weiter'), 'should have pagination')
    assert.ok(/Zeige 1–15 von \d+/.test(html), 'should show the total count')
  })

  it('enables the previous-page link on page 2', async () => {
    let response = await router.fetch(`${CLIENTS_URL}?offset=15`, {
      headers: authHeaders(),
    })

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(
      html.includes('href="/admin/clients?offset=0&amp;sort=registered&amp;order=desc"'),
      'page 2 should link back to page 1',
    )
  })

  it('defaults to newest registrations first', async () => {
    let response = await router.fetch(CLIENTS_URL, {
      headers: authHeaders(),
    })

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('aria-sort="descending"'), 'registered should be the default sort')
    assert.ok(
      html.includes('sort=registered&amp;order=asc'),
      'clicking the registered header should toggle to ascending',
    )
  })

  it('renders status filter tabs and filters by the status param', async () => {
    let response = await router.fetch(`${CLIENTS_URL}?status=active`, {
      headers: authHeaders(),
    })

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('>Alle<') || html.includes('Alle'), 'should render Alle filter tab')
    assert.ok(html.includes('Aktiv'), 'should render Aktiv filter tab')
    assert.ok(html.includes('Inaktiv'), 'should render Inaktiv filter tab')
    assert.ok(html.includes('data-status="Active"'), 'should render Active rows')
    assert.ok(
      !html.includes('data-status="Inactive"'),
      'the status tab should exclude Inactive rows',
    )
  })

  it('filters the grid to inactive clients with ?status=inactive', async () => {
    let response = await router.fetch(`${CLIENTS_URL}?status=inactive`, {
      headers: authHeaders(),
    })

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('data-status="Inactive"'), 'should render Inactive rows')
    assert.ok(!html.includes('data-status="Active"'), 'the status tab should exclude Active rows')
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

  it('resets the page offset when switching status filter tabs', async () => {
    // Switching from page 2 to the Aktiv/Inaktiv tabs must start at page 1,
    // otherwise the smaller result set can land on an empty page.
    let response = await router.fetch(`${CLIENTS_URL}?offset=15&sort=name&order=asc`, {
      headers: authHeaders(),
    })
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(
      html.includes('href="/admin/clients?sort=name&amp;order=asc&amp;status=active"'),
      'Aktiv tab should reset the offset',
    )
  })

  it('treats a filter value of "active" as search text, not a status filter', async () => {
    let response = await router.fetch(`${CLIENTS_URL}?filter=active`, {
      headers: authHeaders(),
    })

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(
      html.includes('Keine Kunden für diese Suche gefunden.'),
      'the search should not silently switch to the Active status tab',
    )
    assert.ok(!html.includes('data-status="Active"'), 'no rows should be status-filtered as Active')
  })

  it('matches a numeric search against id, name, and email', async () => {
    let response = await router.fetch(`${CLIENTS_URL}?filter=1`, {
      headers: authHeaders(),
    })

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('data-row-id="1"'), 'should match the numeric id')
    assert.ok(
      html.includes('data-row-id="10"'),
      'should also match names/emails containing the digits',
    )
  })

  it('treats LIKE wildcards in the search as literal characters', async () => {
    let response = await router.fetch(`${CLIENTS_URL}?filter=%25`, {
      headers: authHeaders(),
    })

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(
      html.includes('Keine Kunden für diese Suche gefunden.'),
      'an escaped % should not match every row',
    )
  })

  it('trims whitespace-only searches instead of filtering everything out', async () => {
    let response = await router.fetch(`${CLIENTS_URL}?filter=%20%20`, {
      headers: authHeaders(),
    })

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('data-row-id="1"'), 'a blank search should not filter rows')
  })

  it('preserves the active sort in the search form', async () => {
    let response = await router.fetch(`${CLIENTS_URL}?sort=email&order=desc`, {
      headers: authHeaders(),
    })
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(
      html.includes('name="sort" value="email"'),
      'search form should carry the active sort column',
    )
    assert.ok(
      html.includes('name="order" value="desc"'),
      'search form should carry the active sort direction',
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
  // GET /admin/clients/:id — frame action-path resolvers
  // -----------------------------------------------------------------------
  it('GET /admin/clients/:id resolves the frame update/destroy action path', async () => {
    let response = await router.fetch(`${CLIENTS_URL}/5`, {
      headers: authHeaders(),
    })

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('Kunde bearbeiten'), 'should render the edit panel')
  })

  it('GET /admin/clients/:id renders the grid for a missing row', async () => {
    let response = await router.fetch(`${CLIENTS_URL}/99999`, {
      headers: authHeaders(),
    })

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('client-grid-content'), 'should render the grid')
    assert.ok(!html.includes('Kunde bearbeiten'), 'should not render an edit panel')
  })

  it('GET /admin/clients/:id/toggle-status resolves the toggle action path', async () => {
    let response = await router.fetch(`${CLIENTS_URL}/5/toggle-status`, {
      headers: authHeaders(),
    })

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('client-grid-content'), 'should render the grid')
  })

  it('preserves grid state on the frame action path', async () => {
    let response = await router.fetch(`${CLIENTS_URL}/5?offset=15&sort=name&order=desc`, {
      headers: authHeaders(),
    })

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(
      html.includes('action="/admin/clients/5?offset=15&amp;sort=name&amp;order=desc"'),
      'the update form should carry the grid state',
    )
  })

  it('carries grid state in the row action URLs', async () => {
    let response = await router.fetch(`${CLIENTS_URL}?offset=15&sort=name&order=desc`, {
      headers: authHeaders(),
    })

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(
      html.includes('toggle-status?offset=15&amp;sort=name&amp;order=desc'),
      'the toggle action should carry the grid state',
    )
  })

  it('carries the status tab in row action URLs and hidden inputs', async () => {
    let response = await router.fetch(
      `${CLIENTS_URL}?offset=15&sort=name&order=desc&status=active`,
      {
        headers: authHeaders(),
      },
    )

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(
      html.includes('toggle-status?offset=15&amp;sort=name&amp;order=desc&amp;status=active'),
      'the toggle action should carry the status tab',
    )
    assert.ok(html.includes('name="_status" value="active"'), 'row forms should round-trip status')
  })

  it('preserves the status tab on the frame action path', async () => {
    let response = await router.fetch(
      `${CLIENTS_URL}/5?offset=15&sort=name&order=desc&status=active`,
      { headers: authHeaders() },
    )

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(
      html.includes(
        'action="/admin/clients/5?offset=15&amp;sort=name&amp;order=desc&amp;status=active"',
      ),
      'the update form should carry the status tab',
    )
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

    let follow = await router.fetch(`${BASE}${location}`, { headers: authHeaders() })
    let html = await follow.text()
    assert.ok(html.includes('Kunde gespeichert.'), 'should surface a success flash')
  })

  it('PUT /admin/clients/21 updates a seeded client without changing its padded name', async () => {
    let existing = await pool.query('SELECT name, email FROM clients WHERE id = 21')
    let row = existing.rows[0]!
    assert.equal(row.name, 'User 021', 'seed names must satisfy the 8-character rule')

    let body = new URLSearchParams({
      _method: 'PUT',
      name: row.name,
      email: row.email,
      status: 'Active',
      _status: 'inactive',
      _offset: '0',
      _sort: 'registered',
      _order: 'desc',
      _csrf: csrfToken!,
    })
    let response = await router.fetch(`${CLIENTS_URL}/21`, {
      method: 'POST',
      body,
      redirect: 'manual',
      headers: authHeaders(),
    })

    assert.equal(response.status, 302)
    let location = response.headers.get('Location') || ''
    assert.ok(location.includes('editing=21'), 'should return to the edit panel')
    assert.ok(location.includes('status=inactive'), 'should keep the status tab')
  })

  it('PUT /admin/clients/0 redirects to the grid with an invalid-id flash', async () => {
    let response = await router.fetch(`${CLIENTS_URL}/0`, {
      method: 'POST',
      body: new URLSearchParams({ _method: 'PUT', name: 'Test', _csrf: csrfToken! }),
      redirect: 'manual',
      headers: authHeaders(),
    })

    assert.equal(response.status, 302)
    let location = response.headers.get('Location') || ''
    assert.ok(location.startsWith('/admin/clients'), 'should return to the grid')

    let follow = await router.fetch(`${BASE}${location}`, { headers: authHeaders() })
    let html = await follow.text()
    assert.ok(html.includes('Ungültige Kunden-ID.'), 'should surface an invalid-id flash')
  })

  it('PUT /admin/clients/99999 reports a missing row instead of silently succeeding', async () => {
    let body = new URLSearchParams({
      _method: 'PUT',
      name: 'No Such Client',
      email: 'no-such@example.com',
      role: 'Viewer',
      status: 'Active',
      registered: '2026-05-01',
      _offset: '0',
      _sort: 'id',
      _order: 'asc',
      _filter: '',
      _csrf: csrfToken!,
    })
    let response = await router.fetch(`${CLIENTS_URL}/99999`, {
      method: 'POST',
      body,
      redirect: 'manual',
      headers: authHeaders(),
    })

    assert.equal(response.status, 302)
    let location = response.headers.get('Location') || ''
    assert.ok(location.startsWith('/admin/clients'), 'should return to the grid')

    let follow = await router.fetch(`${BASE}${location}`, { headers: authHeaders() })
    let html = await follow.text()
    assert.ok(html.includes('Kunde nicht gefunden.'), 'should surface a flash message')
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
    assert.ok(html.includes('Kunde bearbeiten'), 'should show edit form')
    assert.ok(html.includes('Ed'), 'should preserve submitted name value')
    assert.ok(html.includes('ed@example.com'), 'should preserve submitted email value')
  })

  it('keeps the status tab on a validation re-render', async () => {
    let body = new URLSearchParams({
      _method: 'PUT',
      name: 'Ed',
      email: 'ed@example.com',
      role: 'Editor',
      status: 'Active',
      registered: '2026-05-01',
      _offset: '0',
      _sort: 'id',
      _order: 'asc',
      _status: 'active',
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
    assert.ok(html.includes('name="_status" value="active"'), 'should round-trip the status tab')
    assert.ok(
      /Zeige \d+–\d+ von \d+/.test(html),
      'should keep the total count on a validation re-render',
    )
    assert.ok(html.includes('status=active'), 'the edit action should carry the status tab')
  })

  it('PUT with an invalid name and omitted role/status/date keeps the row values', async () => {
    let email = `partial-${Date.now()}@example.com`
    let create = await router.fetch(CLIENTS_URL, {
      method: 'POST',
      body: new URLSearchParams({
        name: 'Known Role Client',
        email,
        role: 'Admin',
        status: 'Inactive',
        registered: '2026-07-04',
        _csrf: csrfToken!,
      }),
      redirect: 'manual',
      headers: authHeaders(),
    })
    assert.equal(create.status, 302)

    let id = Number(new URL(create.headers.get('Location') || '', BASE).searchParams.get('editing'))
    assert.ok(id > 0, 'create should return an id')

    try {
      let response = await router.fetch(`${CLIENTS_URL}/${id}`, {
        method: 'POST',
        body: new URLSearchParams({
          _method: 'PUT',
          name: 'Ed',
          email,
          _csrf: csrfToken!,
        }),
        redirect: 'manual',
        headers: authHeaders(),
      })

      assert.equal(response.status, 200)
      let html = await response.text()
      assert.ok(html.includes('value="Ed"'), 'should preserve the invalid name')
      assert.ok(html.includes('<option value="Admin" selected>'), 'should keep the row role')
      assert.ok(html.includes('<option value="Inactive" selected>'), 'should keep the row status')
      assert.ok(html.includes('value="2026-07-04"'), 'should keep the row registration date')
    } finally {
      await pool.query('DELETE FROM clients WHERE id = $1', [id])
    }
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

    let follow = await router.fetch(`${BASE}${location}`, { headers: authHeaders() })
    let html = await follow.text()
    assert.ok(html.includes('Kunde gelöscht.'), 'should surface a success flash')
  })

  it('DELETE /admin/clients/99999 reports a missing row instead of silently succeeding', async () => {
    let response = await router.fetch(`${CLIENTS_URL}/99999`, {
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
    assert.ok(location.startsWith('/admin/clients'), 'should return to the grid')

    let follow = await router.fetch(`${BASE}${location}`, { headers: authHeaders() })
    let html = await follow.text()
    assert.ok(html.includes('Kunde nicht gefunden.'), 'should surface a flash message')
  })

  it('DELETE /admin/clients/0 redirects to the grid with an invalid-id flash', async () => {
    let response = await router.fetch(`${CLIENTS_URL}/0`, {
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
    assert.ok(location.startsWith('/admin/clients'), 'should return to the grid')

    let follow = await router.fetch(`${BASE}${location}`, { headers: authHeaders() })
    let html = await follow.text()
    assert.ok(html.includes('Ungültige Kunden-ID.'), 'should surface an invalid-id flash')
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

    let follow = await router.fetch(`${BASE}${location}`, { headers: authHeaders() })
    let html = await follow.text()
    assert.ok(html.includes('Kunde angelegt.'), 'should surface a success flash')
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
    assert.ok(html.includes('Neuer Kunde'), 'should re-render create form')
    assert.ok(html.includes('Anlegen'), 'should show Create Record button')
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
    assert.ok(html.includes('Neuer Kunde'), 'should show create form')
    assert.ok(
      html.includes('Bitte ein gültiges Datum aus 2026 angeben.'),
      'should show the German year validation error',
    )
    assert.ok(html.includes('value="2025-06-01"'), 'should preserve submitted date value')
  })

  it('POST /admin/clients with an invalid calendar date re-renders with a field error', async () => {
    let body = new URLSearchParams({
      name: 'ValidNameHere',
      email: 'invaliddate@test.com',
      registered: '2026-02-30',
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
    assert.ok(html.includes('Bitte ein gültiges Datum aus 2026 angeben.'))
    assert.ok(html.includes('aria-invalid="true"'), 'the date field should be marked invalid')
  })

  it('POST /admin/clients rejects an unknown role or status', async () => {
    let body = new URLSearchParams({
      name: 'ValidNameHere',
      email: 'badrole@test.com',
      role: 'Superuser',
      status: 'Pending',
      registered: '2026-05-01',
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
    assert.ok(html.includes('Ungültige Rolle.'), 'should show a role validation error')
    assert.ok(html.includes('Ungültiger Status.'), 'should show a status validation error')
    assert.ok(html.includes('aria-invalid="true"'), 'invalid selects should be marked invalid')
  })

  it('POST /admin/clients with too-long name and email uses the German max-length messages', async () => {
    let body = new URLSearchParams({
      name: 'N'.repeat(101),
      email: 'a'.repeat(89) + '@example.com',
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
    assert.ok(
      html.includes('Der Name darf höchstens 100 Zeichen enthalten.'),
      'should show the German name max-length error',
    )
    assert.ok(
      html.includes('Die E-Mail-Adresse darf höchstens 100 Zeichen enthalten.'),
      'should show the German email max-length error',
    )
  })

  it('POST /admin/clients with an invalid email uses the German email message', async () => {
    let body = new URLSearchParams({
      name: 'ValidNameHere',
      email: 'not-an-email',
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
    assert.ok(
      html.includes('Bitte eine gültige E-Mail-Adresse eingeben.'),
      'should show the German email format error',
    )
  })

  it('POST /admin/clients with a whitespace-only name re-renders instead of throwing', async () => {
    let body = new URLSearchParams({
      name: '        ',
      email: 'spaces@test.com',
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

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('Der Name muss mindestens 8 Zeichen enthalten.'))
    assert.ok(html.includes('role="alert"'), 'the field error should be announced')
  })

  it('POST /admin/clients without registered uses the current date', async () => {
    let email = `no-date-${Date.now()}@example.com`
    let response = await router.fetch(CLIENTS_URL, {
      method: 'POST',
      body: new URLSearchParams({
        name: 'No Date Client',
        email,
        _csrf: csrfToken!,
      }),
      redirect: 'manual',
      headers: authHeaders(),
    })

    assert.equal(response.status, 302)
    let result = await pool.query('SELECT registered FROM clients WHERE email = $1', [email])
    assert.equal(result.rows.length, 1, 'the client should be created')
    let registered = Number(result.rows[0]!.registered)
    assert.ok(
      Math.abs(registered - Date.now()) < 5 * 60 * 1000,
      `registered should default to now, got ${registered}`,
    )
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
    assert.ok(html.includes('Neuer Kunde'), 'should show create form')
    assert.ok(html.includes('value="Bob"'), 'should preserve submitted name value')
    assert.ok(html.includes('value="bob@test.com"'), 'should preserve submitted email value')
    assert.ok(html.includes('Der Name muss mindestens 8 Zeichen enthalten.'))
    assert.ok(html.includes('aria-invalid="true"'), 'the name field should be marked invalid')
    assert.ok(html.includes('role="alert"'), 'the field error should be announced')
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

    let follow = await router.fetch(`${BASE}${location}`, { headers: authHeaders() })
    let html = await follow.text()
    assert.ok(html.includes('Kunde deaktiviert.'), 'should surface a success flash')

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
    assert.ok(html.includes('Neuer Kunde'), 'should show New Record heading')
    assert.ok(html.includes('Anlegen'), 'should show Create Record button')
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
