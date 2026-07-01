import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { db, initializeAppDatabase } from '../../data/setup.ts'
import { sql } from 'remix/data-table'
import { router } from '../../router.ts'
import { createAuthCookieWithCsrfForUser } from '../../test-utils.ts'
import { routes } from '../../routes.ts'

// ---------------------------------------------------------------------------
// Lists Controller integration tests
// Requires a running PostgreSQL database seeded with demo users.
//
// Covers the public /lists endpoints and the admin /admin/lists page with
// the new required `description` field on saved lists.
// ---------------------------------------------------------------------------

const BASE = 'https://remix.run'
const LISTS_URL = `${BASE}/lists`
const ADMIN_LISTS_URL = `${BASE}/admin/lists`

describe('Lists controller', () => {
  let userCookie: string
  let userCsrfToken: string
  let adminCookie: string
  let nonAdminCookie: string

  before(async () => {
    await initializeAppDatabase()

    // Any authenticated user session for public lists endpoints
    let user = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!user?.cookie) throw new Error('Failed to create user session — check user@newapp.com exists')
    userCookie = user.cookie
    userCsrfToken = user.csrfToken

    // Admin session for admin endpoints
    let admin = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    if (!admin?.cookie) throw new Error('Failed to create admin session — check admin@newapp.com exists')
    adminCookie = admin.cookie

    // Non-admin session for permission checks
    let nonAdmin = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!nonAdmin?.cookie) throw new Error('Failed to create non-admin session — check user@newapp.com exists')
    nonAdminCookie = nonAdmin.cookie
  })

  // -----------------------------------------------------------------------
  // GET /lists — page rendering (public, but auth-gated)
  // -----------------------------------------------------------------------

  it('GET /lists redirects to login when not authenticated', async () => {
    let response = await router.fetch(LISTS_URL)
    assert.equal(response.status, 302)
    let location = response.headers.get('Location')
    assert.ok(location?.startsWith(routes.auth.login.index.href()), 'should redirect to login')
    assert.ok(location?.includes('returnTo='), 'should include returnTo with original path')
  })

  it('GET /lists returns 200 when authenticated', async () => {
    let response = await router.fetch(LISTS_URL, {
      headers: { Cookie: userCookie },
    })
    assert.equal(response.status, 200)
    let text = await response.text()
    assert.ok(
      text.includes('Add') || text.includes('list') || text.includes('description'),
      'response should contain list-related content',
    )
  })

  it('GET /lists renders the sidebar layout with Listen header and Neue Liste entry', async () => {
    let response = await router.fetch(LISTS_URL, {
      headers: { Cookie: userCookie },
    })
    let text = await response.text()
    assert.ok(text.includes('Listen'), 'should render sidebar header "Listen"')
    assert.ok(text.includes('Neue Liste'), 'should render "Neue Liste" sidebar entry')
  })

  it('GET /lists sidebar scopes lists to current non-admin user', async () => {
    // Save a list as the current user
    let saveResponse = await router.fetch(`${LISTS_URL}/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        description: 'Owner scoped list',
        items: [{ id: '1', label: 'Item' }],
      }),
    })
    assert.equal(saveResponse.status, 200)
    let { id } = await saveResponse.json()

    // Non-admin user should see the list in sidebar
    let response = await router.fetch(LISTS_URL, {
      headers: { Cookie: userCookie },
    })
    let text = await response.text()
    assert.ok(text.includes('Owner scoped list'), 'non-admin should see own list in sidebar')
    assert.ok(text.includes('?load=' + id), 'sidebar should link to list with load param')
  })

  it('GET /lists sidebar shows admin all lists', async () => {
    // Save a list as the non-admin user (user@newapp.com)
    let saveResponse = await router.fetch(`${LISTS_URL}/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        description: 'Admin visible list',
        items: [{ id: '1', label: 'Admin test' }],
      }),
    })
    assert.equal(saveResponse.status, 200)

    // Admin should see that list in sidebar
    let response = await router.fetch(LISTS_URL, {
      headers: { Cookie: adminCookie },
    })
    let text = await response.text()
    assert.ok(text.includes('Admin visible list'), 'admin should see non-admin list in sidebar')
  })

  it('GET /lists with ?load param sets active list in sidebar', async () => {
    // Save a list to get an id
    let saveResponse = await router.fetch(`${LISTS_URL}/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        description: 'Active list test',
        items: [{ id: '1', label: 'Active item' }],
      }),
    })
    assert.equal(saveResponse.status, 200)
    let { id } = await saveResponse.json()

    // Load with ?load param
    let response = await router.fetch(`${LISTS_URL}?load=${id}`, {
      headers: { Cookie: userCookie },
    })
    let text = await response.text()
    // The active list entry must be marked with aria-current="page"
    assert.ok(text.includes('aria-current="page"'), 'active list entry should have aria-current="page"')
  })

  it('GET /lists with ?load for non-existent or foreign id defaults to Neue Liste', async () => {
    // Use a list id that does not exist (9999999) — should fall back to 'new'
    let response = await router.fetch(`${LISTS_URL}?load=9999999`, {
      headers: { Cookie: userCookie },
    })
    let text = await response.text()
    // The Neue Liste entry should be the active one
    assert.ok(text.includes('aria-current="page"'), 'sidebar should have an active entry when ?load is invalid')
  })

  it('GET /lists without ?load defaults to Neue Liste as active', async () => {
    let response = await router.fetch(LISTS_URL, {
      headers: { Cookie: userCookie },
    })
    let text = await response.text()
    assert.ok(text.includes('Neue Liste'), '"Neue Liste" should render in sidebar')
  })

  it('GET /lists with X-Remix-Target: lists-content returns fragment (no Layout shell)', async () => {
    let response = await router.fetch(LISTS_URL, {
      headers: {
        Cookie: userCookie,
        'X-Remix-Target': 'lists-content',
      },
    })
    let text = await response.text()
    assert.equal(response.status, 200)
    // Fragment renders ListsLayout directly (no outer Frame wrapper).
    // A full page response would have <Frame> with name="lists-content".
    // A fragment response renders the content inline without the Frame element.
    assert.ok(!text.includes('rmx-frame'), 'fragment should not include an outer rmx-frame element')
    assert.ok(text.includes('Neue Liste'), 'fragment should contain sidebar layout content')
  })

  // -----------------------------------------------------------------------
  // POST /lists/save — save a new list with description
  // -----------------------------------------------------------------------

  it('POST /lists/save with description and items returns 200 with id and description', async () => {
    let response = await router.fetch(`${LISTS_URL}/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        description: 'My grocery list',
        items: [
          { id: '1', label: 'Milk' },
          { id: '2', label: 'Eggs' },
        ],
      }),
    })

    assert.equal(response.status, 200)
    let body = await response.json()
    assert.ok(typeof body.id === 'number', 'response should include a numeric id')
    assert.equal(body.description, 'My grocery list', 'response should include the description')
  })

  it('POST /lists/save without description returns 400', async () => {
    let response = await router.fetch(`${LISTS_URL}/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        items: [{ id: '1', label: 'Item A' }],
      }),
    })

    assert.equal(response.status, 400)
    let body = await response.json()
    assert.ok(body.error, 'response should include an error message')
  })

  it('POST /lists/save with empty description returns 400', async () => {
    let response = await router.fetch(`${LISTS_URL}/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        description: '',
        items: [{ id: '1', label: 'Item A' }],
      }),
    })

    assert.equal(response.status, 400)
    let body = await response.json()
    assert.ok(body.error, 'response should include an error message')
  })

  it('POST /lists/save with whitespace-only description returns 400', async () => {
    let response = await router.fetch(`${LISTS_URL}/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        description: '   ',
        items: [{ id: '1', label: 'Item A' }],
      }),
    })

    assert.equal(response.status, 400)
    let body = await response.json()
    assert.ok(body.error, 'response should include an error message')
  })

  it('POST /lists/save without items returns 400', async () => {
    let response = await router.fetch(`${LISTS_URL}/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        description: 'My list',
      }),
    })

    assert.equal(response.status, 400)
    let body = await response.json()
    assert.ok(body.error, 'response should include an error message')
  })

  it('POST /lists/save with empty items array returns 400', async () => {
    let response = await router.fetch(`${LISTS_URL}/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        description: 'My list',
        items: [],
      }),
    })

    assert.equal(response.status, 400)
    let body = await response.json()
    assert.ok(body.error, 'response should include an error message')
  })

  it('POST /lists/save with invalid JSON returns 400', async () => {
    let response = await router.fetch(`${LISTS_URL}/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: '{bad json}',
    })

    assert.equal(response.status, 400)
    let body = await response.json()
    assert.equal(body.error, 'Invalid JSON body')
  })

  // -----------------------------------------------------------------------
  // GET /lists/:id/data — fetch list data by id
  // -----------------------------------------------------------------------

  it('GET /lists/:id/data returns list data including description', async () => {
    // First save a list to get its id
    let saveResponse = await router.fetch(`${LISTS_URL}/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        description: 'Data test list',
        items: [
          { id: '1', label: 'Data Item A' },
          { id: '2', label: 'Data Item B' },
        ],
      }),
    })
    assert.equal(saveResponse.status, 200)
    let { id } = await saveResponse.json()

    let response = await router.fetch(`${LISTS_URL}/${id}/data`, {
      headers: { Cookie: userCookie },
    })

    assert.equal(response.status, 200)
    let data = await response.json()
    assert.ok(typeof data.id === 'number', 'data should include id')
    assert.equal(data.description, 'Data test list', 'data should include description')
    assert.ok(Array.isArray(data.items), 'data should include items array')
    assert.ok(typeof data.created_at === 'number', 'data should include created_at')
    assert.ok(typeof data.updated_at === 'number', 'data should include updated_at')
  })

  it('GET /lists/9999999/data returns 404 for non-existent list', async () => {
    let response = await router.fetch(`${LISTS_URL}/9999999/data`, {
      headers: { Cookie: userCookie },
    })
    assert.equal(response.status, 404)
    let body = await response.json()
    assert.ok(body.error, 'response should include an error message')
  })

  // -----------------------------------------------------------------------
  // PUT /lists/:id/update — update an existing list
  // -----------------------------------------------------------------------

  it('PUT /lists/:id/update updates list description and items', async () => {
    // First save a list
    let saveResponse = await router.fetch(`${LISTS_URL}/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        description: 'Original list',
        items: [{ id: '1', label: 'Item A' }],
      }),
    })
    assert.equal(saveResponse.status, 200)
    let { id } = await saveResponse.json()
    // Update it
    let updateResponse = await router.fetch(`${LISTS_URL}/${id}/update`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        description: 'Updated list',
        items: [
          { id: '1', label: 'Updated Item A' },
          { id: '2', label: 'Item B' },
        ],
      }),
    })

    assert.equal(updateResponse.status, 200)
    let body = await updateResponse.json()
    assert.equal(body.id, id)
    assert.equal(body.description, 'Updated list')

    // Verify data was persisted
    let dataResponse = await router.fetch(`${LISTS_URL}/${id}/data`, {
      headers: { Cookie: userCookie },
    })
    assert.equal(dataResponse.status, 200)
    let data = await dataResponse.json()
    assert.equal(data.description, 'Updated list')
    assert.equal(data.items.length, 2)
  })

  it('PUT /lists/:id/update with invalid ID returns 400', async () => {
    let response = await router.fetch(`${LISTS_URL}/invalid/update`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        description: 'Test',
        items: [{ id: '1', label: 'Item' }],
      }),
    })
    assert.equal(response.status, 400)
  })

  it('PUT /lists/:id/update for non-existent list returns 404', async () => {
    let response = await router.fetch(`${LISTS_URL}/9999999/update`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        description: 'Test',
        items: [{ id: '1', label: 'Item' }],
      }),
    })
    assert.equal(response.status, 404)
  })

  it('PUT /lists/:id/update without description returns 400', async () => {
    let saveResponse = await router.fetch(`${LISTS_URL}/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        description: 'List for update test',
        items: [{ id: '1', label: 'Item' }],
      }),
    })
    let { id } = await saveResponse.json()

    let response = await router.fetch(`${LISTS_URL}/${id}/update`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        items: [{ id: '1', label: 'Item' }],
      }),
    })
    assert.equal(response.status, 400)
  })

  it('PUT /lists/:id/update with empty items returns 400', async () => {
    let saveResponse = await router.fetch(`${LISTS_URL}/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        description: 'List for empty items test',
        items: [{ id: '1', label: 'Item' }],
      }),
    })
    let { id } = await saveResponse.json()

    let response = await router.fetch(`${LISTS_URL}/${id}/update`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        description: 'Test',
        items: [],
      }),
    })
    assert.equal(response.status, 400)
  })

  // -----------------------------------------------------------------------
  // GET /admin/lists — admin page (admin-gated)
  // -----------------------------------------------------------------------

  it('GET /admin/lists redirects to login when not authenticated', async () => {
    let response = await router.fetch(ADMIN_LISTS_URL)
    assert.equal(response.status, 302)
    let location = response.headers.get('Location')
    assert.ok(location?.startsWith(routes.auth.login.index.href()), 'should redirect to login')
  })

  it('GET /admin/lists returns 403 for non-admin users', async () => {
    let response = await router.fetch(ADMIN_LISTS_URL, {
      headers: { Cookie: nonAdminCookie },
    })
    assert.equal(response.status, 403)
    let text = await response.text()
    assert.ok(
      text.includes('403') || text.includes('admin access'),
      'response should indicate forbidden access',
    )
  })

  it('GET /admin/lists returns 200 for admin users', async () => {
    let response = await router.fetch(ADMIN_LISTS_URL, {
      headers: { Cookie: adminCookie },
    })
    assert.equal(response.status, 200)
  })

  it('GET /admin/lists includes Description column header', async () => {
    let response = await router.fetch(ADMIN_LISTS_URL, {
      headers: { Cookie: adminCookie },
    })
    let text = await response.text()
    assert.ok(text.includes('Beschreibung'), 'table should include Beschreibung column header')
  })

  // -----------------------------------------------------------------------
  // GET /admin/lists — filter tests with GIN-backed search
  // -----------------------------------------------------------------------

  it('GET /admin/lists?filter= finds lists by description', async () => {
    let response = await router.fetch(`${ADMIN_LISTS_URL}?filter=Data+test`, {
      headers: { Cookie: adminCookie },
    })
    assert.equal(response.status, 200)
    let text = await response.text()
    assert.ok(text.includes('Data test list'), 'should find list with matching description')
  })

  it('GET /admin/lists?filter= finds lists by item label', async () => {
    let response = await router.fetch(`${ADMIN_LISTS_URL}?filter=Milk`, {
      headers: { Cookie: adminCookie },
    })
    assert.equal(response.status, 200)
    let text = await response.text()
    assert.ok(text.includes('My grocery'), 'should find list containing item with matching label')
  })

  it('GET /admin/lists?filter= is case-insensitive', async () => {
    let response = await router.fetch(`${ADMIN_LISTS_URL}?filter=milk`, {
      headers: { Cookie: adminCookie },
    })
    assert.equal(response.status, 200)
    let text = await response.text()
    assert.ok(text.includes('My grocery'), 'should match case-insensitively')
  })

  it('GET /admin/lists without filter shows all lists', async () => {
    let response = await router.fetch(ADMIN_LISTS_URL, {
      headers: { Cookie: adminCookie },
    })
    assert.equal(response.status, 200)
    let text = await response.text()
    // Should show multiple lists from seed + test data
    assert.ok(text.includes('Gespeicherte Listen'), 'should render the page')
  })

  it('GET /admin/lists?filter= shows empty state when no match', async () => {
    let response = await router.fetch(`${ADMIN_LISTS_URL}?filter=ZZZZNOTFOUND`, {
      headers: { Cookie: adminCookie },
    })
    assert.equal(response.status, 200)
    let text = await response.text()
    assert.ok(
      text.includes('Keine Listen für diese Suche gefunden.'),
      'should show search-specific empty state',
    )
  })

  it('GET /admin/lists?filter= renders filter input with current value', async () => {
    let response = await router.fetch(`${ADMIN_LISTS_URL}?filter=test`, {
      headers: { Cookie: adminCookie },
    })
    assert.equal(response.status, 200)
    let text = await response.text()
    assert.ok(
      text.includes('value="test"') || text.includes("value='test'"),
      'filter input should show current filter value',
    )
  })

  it('GET /admin/lists?filter= shows Clear link', async () => {
    let response = await router.fetch(`${ADMIN_LISTS_URL}?filter=test`, {
      headers: { Cookie: adminCookie },
    })
    assert.equal(response.status, 200)
    let text = await response.text()
    assert.ok(text.includes('Zurücksetzen'), 'should show Zurücksetzen link when filter is active')
  })

  it('GET /admin/lists without filter does not show Clear link', async () => {
    let response = await router.fetch(ADMIN_LISTS_URL, {
      headers: { Cookie: adminCookie },
    })
    assert.equal(response.status, 200)
    let text = await response.text()
    assert.ok(text.includes('Suchen'), 'should show search button')
    assert.ok(!text.includes('Zurücksetzen'), 'should NOT show Zurücksetzen link when no filter is active')
  })

  it('GET /admin/lists preserves filter across pagination', async () => {
    let response = await router.fetch(`${ADMIN_LISTS_URL}?filter=Milk&offset=0`, {
      headers: { Cookie: adminCookie },
    })
    assert.equal(response.status, 200)
    let text = await response.text()
    // Pagination links should include filter param
    assert.ok(
      text.includes('filter=Milk') || text.includes('filter=milk'),
      'pagination links should preserve filter',
    )
  })

  it('GET /admin/lists?filter= renders item labels from parsed JSONB', async () => {
    // Save a list with unique items that can be found by filter
    let uniqueLabel = `RenderedItem-${Date.now()}`
    let saveResponse = await router.fetch(`${LISTS_URL}/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        description: 'JSONB Parse Test List',
        items: [
          { id: 'a', label: uniqueLabel },
          { id: 'b', label: 'Second Item' },
        ],
      }),
    })
    assert.equal(saveResponse.status, 200)
    let { id } = await saveResponse.json()

    // Filter by the unique label — should find the list
    let response = await router.fetch(`${ADMIN_LISTS_URL}?filter=${encodeURIComponent(uniqueLabel)}`, {
      headers: { Cookie: adminCookie },
    })
    assert.equal(response.status, 200)
    let text = await response.text()

    // The item label should be rendered in the HTML (proves list JSONB was parsed to array)
    assert.ok(text.includes(uniqueLabel), 'filtered list should render item labels from parsed JSONB')
    // The description should also appear
    assert.ok(text.includes('JSONB Parse Test List'), 'filtered list should show its description')
  })
})
