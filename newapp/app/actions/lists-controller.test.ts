import { describe, it, before, after } from 'remix/test'
import * as assert from 'remix/assert'

import { db, initializeAppDatabase } from '../data/setup.ts'
import { sql } from 'remix/data-table'
import { router } from '../router.ts'
import { createAuthCookieWithCsrfForUser } from '../test-utils.ts'

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

const testListIds: number[] = []

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

  after(async () => {
    for (let id of testListIds) {
      try {
        await db.exec(sql`DELETE FROM lists WHERE id = ${id}`)
      } catch {
        /* ignore cleanup errors */
      }
    }
  })

  // -----------------------------------------------------------------------
  // GET /lists — page rendering (public, but auth-gated)
  // -----------------------------------------------------------------------

  it('GET /lists redirects to login when not authenticated', async () => {
    let response = await router.fetch(LISTS_URL)
    assert.equal(response.status, 302)
    let location = response.headers.get('Location')
    assert.ok(location?.startsWith('/login'), 'should redirect to /login')
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
    testListIds.push(body.id)
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
    testListIds.push(id)

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
  // GET /admin/lists — admin page (admin-gated)
  // -----------------------------------------------------------------------

  it('GET /admin/lists redirects to login when not authenticated', async () => {
    let response = await router.fetch(ADMIN_LISTS_URL)
    assert.equal(response.status, 302)
    let location = response.headers.get('Location')
    assert.ok(location?.startsWith('/login'), 'should redirect to /login')
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
    assert.ok(text.includes('Description'), 'table should include Description column header')
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
    assert.ok(text.includes('Saved Lists'), 'should render the page')
  })

  it('GET /admin/lists?filter= shows empty state when no match', async () => {
    let response = await router.fetch(`${ADMIN_LISTS_URL}?filter=ZZZZNOTFOUND`, {
      headers: { Cookie: adminCookie },
    })
    assert.equal(response.status, 200)
    let text = await response.text()
    assert.ok(
      text.includes('No lists found for this search'),
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
    assert.ok(text.includes('Clear'), 'should show Clear link when filter is active')
  })

  it('GET /admin/lists without filter does not show Clear link', async () => {
    let response = await router.fetch(ADMIN_LISTS_URL, {
      headers: { Cookie: adminCookie },
    })
    assert.equal(response.status, 200)
    let text = await response.text()
    assert.ok(text.includes('Search'), 'should show search button')
    assert.ok(!text.includes('Clear'), 'should NOT show Clear link when no filter is active')
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
})
