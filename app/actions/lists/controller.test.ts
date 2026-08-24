import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { db, initializeAppDatabase } from '../../db.ts'
import { sql } from 'remix/data-table'
import { lists } from '../../data/schema.ts'
import { router } from '../../test-router.ts'
import { createAuthCookieWithCsrfForUser } from '../../test-utils.ts'
import { routes } from '../../routes.ts'

// ---------------------------------------------------------------------------
// Lists Controller integration tests
// Requires a running PostgreSQL database seeded with demo users.
//
// Covers the public /lists endpoints and the admin /admin/lists page.
// ---------------------------------------------------------------------------

const BASE = 'https://remix.run'
const LISTS_URL = `${BASE}/lists`
const ADMIN_LISTS_URL = `${BASE}/admin/lists`

describe('Lists controller', () => {
  let userCookie: string
  let userCsrfToken: string
  let adminCookie: string
  let adminCsrfToken: string
  let nonAdminCookie: string

  before(async () => {
    await initializeAppDatabase()

    let user = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!user?.cookie)
      throw new Error('Failed to create user session — check user@newapp.com exists')
    userCookie = user.cookie
    userCsrfToken = user.csrfToken

    let admin = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    if (!admin?.cookie)
      throw new Error('Failed to create admin session — check admin@newapp.com exists')
    adminCookie = admin.cookie
    adminCsrfToken = admin.csrfToken

    let nonAdmin = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!nonAdmin?.cookie)
      throw new Error('Failed to create non-admin session — check user@newapp.com exists')
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
    let saveResponse = await router.fetch(LISTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        description: 'Owner scoped list',
        items: [{ label: 'Item' }],
      }),
    })
    assert.equal(saveResponse.status, 200)
    let { id } = await saveResponse.json()

    let response = await router.fetch(LISTS_URL, {
      headers: { Cookie: userCookie },
    })
    let text = await response.text()
    assert.ok(text.includes('Owner scoped list'), 'non-admin should see own list in sidebar')
    assert.ok(text.includes('?load=' + id), 'sidebar should link to list with load param')
  })

  it('GET /lists sidebar renders done/total progress badge', async () => {
    let saveResponse = await router.fetch(LISTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        description: 'Progress badge list',
        items: [{ label: 'Done item', done: true }, { label: 'Open item' }],
      }),
    })
    assert.equal(saveResponse.status, 200)
    let { id } = await saveResponse.json()

    let response = await router.fetch(`${LISTS_URL}?ids=${id}`, {
      headers: { Cookie: userCookie },
    })
    let text = await response.text()
    assert.ok(text.includes('1 von 2 erledigt'), 'badge should show done/total progress')
  })

  it('GET /lists sidebar shows admin all lists', async () => {
    let saveResponse = await router.fetch(LISTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        description: 'Admin visible list',
        items: [{ label: 'Admin test' }],
      }),
    })
    assert.equal(saveResponse.status, 200)

    let response = await router.fetch(LISTS_URL, {
      headers: { Cookie: adminCookie },
    })
    let text = await response.text()
    assert.ok(text.includes('Admin visible list'), 'admin should see non-admin list in sidebar')
  })

  it('GET /lists with ?load param sets active list in sidebar', async () => {
    let saveResponse = await router.fetch(LISTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        description: 'Active list test',
        items: [{ label: 'Active item' }],
      }),
    })
    assert.equal(saveResponse.status, 200)
    let { id } = await saveResponse.json()

    let response = await router.fetch(`${LISTS_URL}?load=${id}`, {
      headers: { Cookie: userCookie },
    })
    let text = await response.text()
    assert.ok(
      text.includes('aria-current="page"'),
      'active list entry should have aria-current="page"',
    )
  })

  it('GET /lists with ?load for non-existent or foreign id defaults to Neue Liste', async () => {
    let response = await router.fetch(`${LISTS_URL}?load=9999999`, {
      headers: { Cookie: userCookie },
    })
    let text = await response.text()
    assert.ok(
      text.includes('aria-current="page"'),
      'sidebar should have an active entry when ?load is invalid',
    )
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
    assert.ok(!text.includes('rmx-frame'), 'fragment should not include an outer rmx-frame element')
    assert.ok(text.includes('Neue Liste'), 'fragment should contain sidebar layout content')
  })

  // -----------------------------------------------------------------------
  // POST /lists — create a new list with description
  // -----------------------------------------------------------------------

  it('POST /lists with description and items returns 200 with id, description, items and updated_at', async () => {
    let response = await router.fetch(LISTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        description: 'My grocery list',
        items: [{ label: 'Milk' }, { label: 'Eggs' }],
      }),
    })

    assert.equal(response.status, 200)
    let body = await response.json()
    assert.ok(typeof body.id === 'number', 'response should include a numeric id')
    assert.equal(body.description, 'My grocery list', 'response should include the description')
    assert.ok(Array.isArray(body.items), 'response should include items array')
    assert.equal(body.items.length, 2, 'should have 2 items')
    assert.ok(typeof body.updated_at === 'number', 'response should include updated_at')
    assert.ok(body.updated_at > 0, 'updated_at should be a valid timestamp')
  })

  it('POST /lists without description returns 400', async () => {
    let response = await router.fetch(LISTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        items: [{ label: 'Item A' }],
      }),
    })

    assert.equal(response.status, 400)
    let body = await response.json()
    assert.ok(body.error, 'response should include an error message')
  })

  it('POST /lists with empty description returns 400', async () => {
    let response = await router.fetch(LISTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        description: '',
        items: [{ label: 'Item A' }],
      }),
    })

    assert.equal(response.status, 400)
    let body = await response.json()
    assert.ok(body.error, 'response should include an error message')
  })

  it('POST /lists with whitespace-only description returns 400', async () => {
    let response = await router.fetch(LISTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        description: '   ',
        items: [{ label: 'Item A' }],
      }),
    })

    assert.equal(response.status, 400)
    let body = await response.json()
    assert.ok(body.error, 'response should include an error message')
  })

  it('POST /lists without items returns 400', async () => {
    let response = await router.fetch(LISTS_URL, {
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

  it('POST /lists with empty items array returns 400', async () => {
    let response = await router.fetch(LISTS_URL, {
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

  it('POST /lists with invalid JSON returns 400', async () => {
    let response = await router.fetch(LISTS_URL, {
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
  // PUT /lists/:id — partial update (patch) with If-Match
  // -----------------------------------------------------------------------

  it('PUT /lists/:id (patch) description-only updates description', async () => {
    let saveResponse = await router.fetch(LISTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        description: 'Original list',
        items: [{ label: 'Item A' }],
      }),
    })
    assert.equal(saveResponse.status, 200)
    let { id, updated_at } = await saveResponse.json()

    let patchResponse = await router.fetch(`${LISTS_URL}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
        'If-Match': String(updated_at),
      },
      body: JSON.stringify({ description: 'New desc' }),
    })
    assert.equal(patchResponse.status, 200)
    let body = await patchResponse.json()
    assert.equal(body.id, id)
    assert.equal(body.description, 'New desc')
    assert.ok(body.items.length === 1, 'items should be preserved')
    assert.ok(body.updated_at > updated_at, 'updated_at should increase')
  })

  it('PUT /lists/:id (patch) items-only updates items', async () => {
    let saveResponse = await router.fetch(LISTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        description: 'Items update test',
        items: [{ label: 'Old Item' }],
      }),
    })
    assert.equal(saveResponse.status, 200)
    let { id, updated_at } = await saveResponse.json()

    let patchResponse = await router.fetch(`${LISTS_URL}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
        'If-Match': String(updated_at),
      },
      body: JSON.stringify({
        items: [{ label: 'New Item A' }, { label: 'New Item B' }],
      }),
    })
    assert.equal(patchResponse.status, 200)
    let body = await patchResponse.json()
    assert.equal(body.id, id)
    assert.equal(body.description, 'Items update test', 'description should be preserved')
    assert.equal(body.items.length, 2, 'should have 2 items')
    assert.equal(body.items[0].label, 'New Item A')
    assert.equal(body.items[1].label, 'New Item B')
    assert.ok(body.updated_at > updated_at, 'updated_at should increase')
  })

  it('PUT /lists/invalid (patch) returns 400 for invalid ID', async () => {
    let response = await router.fetch(`${LISTS_URL}/invalid`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        description: 'Test',
      }),
    })
    assert.equal(response.status, 400)
  })

  it('PUT /lists/9999999 (patch) returns 404 for non-existent list', async () => {
    let response = await router.fetch(`${LISTS_URL}/9999999`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
        'If-Match': '0',
      },
      body: JSON.stringify({
        description: 'Test',
        items: [{ label: 'Item' }],
      }),
    })
    assert.equal(response.status, 404)
  })

  it("PUT /lists/:id (patch) returns 404 for another user's list", async () => {
    let saveResponse = await router.fetch(LISTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': adminCsrfToken,
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        description: 'Admin owned list',
        items: [{ label: 'Admin item' }],
      }),
    })
    assert.equal(saveResponse.status, 200)
    let { id, updated_at } = await saveResponse.json()

    let patchResponse = await router.fetch(`${LISTS_URL}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
        'If-Match': String(updated_at),
      },
      body: JSON.stringify({ description: 'Hacked' }),
    })
    assert.equal(patchResponse.status, 404)
  })

  it('PUT /lists/:id (patch) with stale If-Match returns 409', async () => {
    let saveResponse = await router.fetch(LISTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        description: 'Conflict test',
        items: [{ label: 'Item' }],
      }),
    })
    assert.equal(saveResponse.status, 200)
    let { id, updated_at: origUpdatedAt } = await saveResponse.json()

    // Advance updated_at via a successful patch
    let firstPatch = await router.fetch(`${LISTS_URL}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
        'If-Match': String(origUpdatedAt),
      },
      body: JSON.stringify({ description: 'First edit' }),
    })
    assert.equal(firstPatch.status, 200)

    // Now try patch with the original stale updated_at
    let conflictResponse = await router.fetch(`${LISTS_URL}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
        'If-Match': String(origUpdatedAt),
      },
      body: JSON.stringify({ description: 'Stale edit' }),
    })
    assert.equal(conflictResponse.status, 409)
    let conflictBody = await conflictResponse.json()
    assert.ok(conflictBody.updated_at > origUpdatedAt, '409 body should return current updated_at')
    assert.equal(
      conflictBody.description,
      'First edit',
      '409 body should return current description',
    )
  })

  it('PUT /lists/:id (patch) force overwrite after conflict', async () => {
    let saveResponse = await router.fetch(LISTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        description: 'Force overwrite test',
        items: [{ label: 'Item' }],
      }),
    })
    assert.equal(saveResponse.status, 200)
    let { id, updated_at: origUpdatedAt } = await saveResponse.json()

    // Advance updated_at
    let firstPatch = await router.fetch(`${LISTS_URL}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
        'If-Match': String(origUpdatedAt),
      },
      body: JSON.stringify({ description: 'First edit' }),
    })
    assert.equal(firstPatch.status, 200)

    // Get conflict with stale If-Match
    let conflictResponse = await router.fetch(`${LISTS_URL}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
        'If-Match': String(origUpdatedAt),
      },
      body: JSON.stringify({ description: 'Stale edit' }),
    })
    assert.equal(conflictResponse.status, 409)
    let conflictBody = await conflictResponse.json()

    // Retry with the updated_at from the 409 body → should succeed
    let retryResponse = await router.fetch(`${LISTS_URL}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
        'If-Match': String(conflictBody.updated_at),
      },
      body: JSON.stringify({ description: 'Overwritten' }),
    })
    assert.equal(retryResponse.status, 200)
    let finalBody = await retryResponse.json()
    assert.equal(finalBody.description, 'Overwritten')
    assert.ok(
      finalBody.updated_at >= conflictBody.updated_at,
      'final updated_at should be at least the conflict value',
    )
  })

  it('PUT /lists/:id (patch) with empty body returns 400', async () => {
    let saveResponse = await router.fetch(LISTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        description: 'Empty body test',
        items: [{ label: 'Item' }],
      }),
    })
    assert.equal(saveResponse.status, 200)
    let { id, updated_at } = await saveResponse.json()

    let response = await router.fetch(`${LISTS_URL}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
        'If-Match': String(updated_at),
      },
      body: JSON.stringify({}),
    })
    assert.equal(response.status, 400)
    let body = await response.json()
    assert.ok(body.error, 'response should include an error message')
  })

  it('PUT /lists/:id (patch) with empty items array returns 400', async () => {
    let saveResponse = await router.fetch(LISTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        description: 'Empty items test',
        items: [{ label: 'Item' }],
      }),
    })
    assert.equal(saveResponse.status, 200)
    let { id, updated_at } = await saveResponse.json()

    let response = await router.fetch(`${LISTS_URL}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
        'If-Match': String(updated_at),
      },
      body: JSON.stringify({
        items: [],
      }),
    })
    assert.equal(response.status, 400)
    let body = await response.json()
    assert.ok(body.error, 'response should include an error message')
  })

  // -----------------------------------------------------------------------
  // POST /lists/:id/move — move an item between lists
  // -----------------------------------------------------------------------

  async function createListFor(
    cookie: string,
    csrfToken: string,
    description: string,
    itemLabels: string[],
  ) {
    let response = await router.fetch(LISTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': csrfToken,
        Cookie: cookie,
      },
      body: JSON.stringify({
        description,
        items: itemLabels.map((label) => ({ label })),
      }),
    })
    assert.equal(response.status, 200)
    return await response.json()
  }

  it('POST /lists/:id/move moves an item and returns updated source and target', async () => {
    let source = await createListFor(userCookie, userCsrfToken, 'Move source', ['Alpha', 'Beta'])
    let target = await createListFor(userCookie, userCsrfToken, 'Move target', ['Existing'])

    let itemId = source.items[0].id
    let response = await router.fetch(`${LISTS_URL}/${source.id}/move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
        'If-Match': String(source.updated_at),
      },
      body: JSON.stringify({ targetId: target.id, itemId }),
    })
    assert.equal(response.status, 200)
    let body = await response.json()
    assert.equal(body.source.items.length, 1)
    assert.equal(body.source.items[0].label, 'Beta')
    assert.equal(body.target.items.length, 2)
    assert.equal(body.target.items[0].label, 'Existing')
    assert.equal(body.target.items[1].id, itemId, 'moved item appended to target')
    assert.ok(body.source.updated_at >= source.updated_at)
    assert.ok(body.target.updated_at >= target.updated_at)
  })

  it('POST /lists/:id/move rejects moving the last item with 400', async () => {
    let source = await createListFor(userCookie, userCsrfToken, 'Lonely source', ['Only'])
    let target = await createListFor(userCookie, userCsrfToken, 'Any target', ['Keep'])

    let response = await router.fetch(`${LISTS_URL}/${source.id}/move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
        'If-Match': String(source.updated_at),
      },
      body: JSON.stringify({ targetId: target.id, itemId: source.items[0].id }),
    })
    assert.equal(response.status, 400)
    let body = await response.json()
    assert.ok(body.error, 'response should include an error message')
  })

  it('POST /lists/:id/move rejects moving into the same list with 400', async () => {
    let source = await createListFor(userCookie, userCsrfToken, 'Self source', ['A', 'B'])

    let response = await router.fetch(`${LISTS_URL}/${source.id}/move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
        'If-Match': String(source.updated_at),
      },
      body: JSON.stringify({ targetId: source.id, itemId: source.items[0].id }),
    })
    assert.equal(response.status, 400)
    let body = await response.json()
    assert.ok(body.error, 'response should include an error message')
  })

  it('POST /lists/:id/move without If-Match returns 400', async () => {
    let source = await createListFor(userCookie, userCsrfToken, 'No pre source', ['A', 'B'])
    let target = await createListFor(userCookie, userCsrfToken, 'No pre target', ['Keep'])

    let response = await router.fetch(`${LISTS_URL}/${source.id}/move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({ targetId: target.id, itemId: source.items[0].id }),
    })
    assert.equal(response.status, 400)
    let body = await response.json()
    assert.ok(body.error, 'response should include an error message')
  })

  it("POST /lists/:id/move returns 404 for another user's target list", async () => {
    let source = await createListFor(userCookie, userCsrfToken, 'User source', ['A', 'B'])
    let adminTarget = await createListFor(adminCookie, adminCsrfToken, 'Admin target', ['Keep'])

    let response = await router.fetch(`${LISTS_URL}/${source.id}/move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
        'If-Match': String(source.updated_at),
      },
      body: JSON.stringify({ targetId: adminTarget.id, itemId: source.items[0].id }),
    })
    assert.equal(response.status, 404)
  })

  it('POST /lists/:id/move with stale If-Match returns 409 with current source row', async () => {
    let source = await createListFor(userCookie, userCsrfToken, 'Stale source', ['A', 'B'])
    let target = await createListFor(userCookie, userCsrfToken, 'Stale target', ['Keep'])

    let response = await router.fetch(`${LISTS_URL}/${source.id}/move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
        'If-Match': String(source.updated_at - 9999),
      },
      body: JSON.stringify({ targetId: target.id, itemId: source.items[0].id }),
    })
    assert.equal(response.status, 409)
    let body = await response.json()
    assert.equal(body.description, 'Stale source')
    assert.equal(body.items.length, 2, 'source not modified')
  })

  it('POST /lists/:id/move with _if_match fallback in body succeeds', async () => {
    let source = await createListFor(userCookie, userCsrfToken, 'Beacon source', ['X', 'Y'])
    let target = await createListFor(userCookie, userCsrfToken, 'Beacon target', ['Keep'])

    let response = await router.fetch(`${LISTS_URL}/${source.id}/move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        targetId: target.id,
        itemId: source.items[0].id,
        _if_match: String(source.updated_at),
      }),
    })
    assert.equal(response.status, 200)
  })

  // -----------------------------------------------------------------------
  // POST /lists/:id/delete — destroy a list
  // -----------------------------------------------------------------------

  it('POST /lists/:id/delete deletes own list and redirects to /lists', async () => {
    let saveResponse = await router.fetch(LISTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        description: 'List to delete',
        items: [{ label: 'Item' }],
      }),
    })
    assert.equal(saveResponse.status, 200)
    let { id } = await saveResponse.json()

    let deleteResponse = await router.fetch(`${LISTS_URL}/${id}/delete`, {
      method: 'POST',
      headers: {
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
    })
    assert.equal(deleteResponse.status, 302)
    let location = deleteResponse.headers.get('Location')
    assert.equal(location, '/lists')

    let row = await db.findOne(lists, { where: { id } })
    assert.equal(row, null, 'list should be deleted')
  })

  it('POST /lists/9999999/delete returns 404 for non-existent list', async () => {
    let response = await router.fetch(`${LISTS_URL}/9999999/delete`, {
      method: 'POST',
      headers: {
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
    })
    assert.equal(response.status, 404)
    let body = await response.json()
    assert.ok(body.error, 'response should include an error message')
  })

  it('POST /lists/:id/delete returns 404 for another users list', async () => {
    let saveResponse = await router.fetch(LISTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': adminCsrfToken,
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        description: 'Admin owned list',
        items: [{ label: 'Admin item' }],
      }),
    })
    assert.equal(saveResponse.status, 200)
    let { id } = await saveResponse.json()

    let response = await router.fetch(`${LISTS_URL}/${id}/delete`, {
      method: 'POST',
      headers: {
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
    })
    assert.equal(response.status, 404)
    let body = await response.json()
    assert.ok(body.error, 'response should include an error message')

    let row = await db.findOne(lists, { where: { id } })
    assert.ok(row, 'list should still exist')
  })

  it('POST /lists/invalid/delete returns 400 for invalid list ID', async () => {
    let response = await router.fetch(`${LISTS_URL}/invalid/delete`, {
      method: 'POST',
      headers: {
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
    })
    assert.equal(response.status, 400)
    let body = await response.json()
    assert.ok(body.error, 'response should include an error message')
  })

  it('POST /lists/:id/delete as admin deletes any users list', async () => {
    let saveResponse = await router.fetch(LISTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        description: 'Admin delete target',
        items: [{ label: 'Item' }],
      }),
    })
    assert.equal(saveResponse.status, 200)
    let { id } = await saveResponse.json()

    let deleteResponse = await router.fetch(`${LISTS_URL}/${id}/delete`, {
      method: 'POST',
      headers: {
        'X-Csrf-Token': adminCsrfToken,
        Cookie: adminCookie,
      },
    })
    assert.equal(deleteResponse.status, 302)

    let row = await db.findOne(lists, { where: { id } })
    assert.equal(row, null, 'list should be deleted')
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
    let response = await router.fetch(`${ADMIN_LISTS_URL}?filter=Admin+visible`, {
      headers: { Cookie: adminCookie },
    })
    assert.equal(response.status, 200)
    let text = await response.text()
    assert.ok(text.includes('Admin visible list'), 'should find list with matching description')
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
    assert.ok(text.includes('Gespeicherte Listen'), 'should render the page')
    assert.ok(
      text.includes('data-rmx-history="replace"'),
      'filter form should carry data-rmx-history="replace"',
    )
    assert.ok(
      text.includes('data-rmx-target="admin-content"'),
      'filter form should target the admin content frame',
    )
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
    assert.ok(
      !text.includes('Zurücksetzen'),
      'should NOT show Zurücksetzen link when no filter is active',
    )
  })

  it('GET /admin/lists preserves filter across pagination', async () => {
    let response = await router.fetch(`${ADMIN_LISTS_URL}?filter=Milk&offset=0`, {
      headers: { Cookie: adminCookie },
    })
    assert.equal(response.status, 200)
    let text = await response.text()
    assert.ok(
      text.includes('filter=Milk') || text.includes('filter=milk'),
      'pagination links should preserve filter',
    )
  })

  it('GET /admin/lists?filter= renders item labels from parsed JSONB', async () => {
    let uniqueLabel = `RenderedItem-${Date.now()}`
    let saveResponse = await router.fetch(LISTS_URL, {
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

    let response = await router.fetch(
      `${ADMIN_LISTS_URL}?filter=${encodeURIComponent(uniqueLabel)}`,
      {
        headers: { Cookie: adminCookie },
      },
    )
    assert.equal(response.status, 200)
    let text = await response.text()

    assert.ok(
      text.includes(uniqueLabel),
      'filtered list should render item labels from parsed JSONB',
    )
    assert.ok(text.includes('JSONB Parse Test List'), 'filtered list should show its description')
  })

  // -----------------------------------------------------------------------
  // Title field
  // -----------------------------------------------------------------------

  it('POST /lists accepts an optional title and returns it', async () => {
    let response = await router.fetch(LISTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        title: 'Titelliste',
        description: 'Beschreibung',
        items: [{ label: 'Item' }],
      }),
    })
    assert.equal(response.status, 200)
    let data = await response.json()
    assert.equal(data.title, 'Titelliste')
    assert.equal(data.description, 'Beschreibung')
  })

  it('GET /lists sidebar renders the list title', async () => {
    let title = `SidebarTitle-${Date.now()}`
    let saveResponse = await router.fetch(LISTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        title,
        description: 'Long description',
        items: [{ label: 'Item' }],
      }),
    })
    assert.equal(saveResponse.status, 200)

    let response = await router.fetch(LISTS_URL, { headers: { Cookie: userCookie } })
    let text = await response.text()
    assert.ok(text.includes(title), 'sidebar should render the list title')
  })

  it('admin search matches a list by title when the description differs', async () => {
    let title = `SearchTitle-${Date.now()}`
    let description = `SearchDesc-${Date.now()}`
    let saveResponse = await router.fetch(LISTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        title,
        description,
        items: [{ label: 'Item' }],
      }),
    })
    assert.equal(saveResponse.status, 200)

    let response = await router.fetch(`${ADMIN_LISTS_URL}?filter=${encodeURIComponent(title)}`, {
      headers: { Cookie: adminCookie },
    })
    assert.equal(response.status, 200)
    let text = await response.text()
    assert.ok(
      text.includes(description),
      'admin search should match a list by title even when description differs',
    )
  })
})
