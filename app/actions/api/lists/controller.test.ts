import { describe, it, before, after } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../../../test-router.ts'
import { initializeAppDatabase } from '../../../db.ts'
import { pool } from '../../../data/test-pool.ts'
import { hashToken } from '../../../utils/api-token.ts'

const BASE = 'https://remix.run'
const API_URL = `${BASE}/api/lists`

describe('API Lists controller', () => {
  let authToken: string

  before(async () => {
    await initializeAppDatabase()

    let loginResponse = await router.fetch(`${BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@newapp.com',
        password: process.env.SEED_ADMIN_PASSWORD!,
      }),
    })
    assert.equal(loginResponse.status, 200, 'login must succeed for per-user token tests')
    let body = await loginResponse.json()
    authToken = body.token
  })

  after(async () => {
    await pool.query(`DELETE FROM api_tokens WHERE token_hash = $1`, [hashToken(authToken)])
  })

  it('returns 401 when Authorization header is missing', async () => {
    let response = await router.fetch(API_URL)
    assert.equal(response.status, 401)
  })

  it('returns 401 for invalid token', async () => {
    let response = await router.fetch(API_URL, {
      headers: { Authorization: 'Bearer wrong-token' },
    })
    assert.equal(response.status, 401)
  })

  it('returns 401 for non-Bearer scheme', async () => {
    let response = await router.fetch(API_URL, {
      headers: { Authorization: 'Basic dXNlcjpwYXNz' },
    })
    assert.equal(response.status, 401)
  })

  // -----------------------------------------------------------------------
  // GET /api/lists — list all (using per-user token)
  // -----------------------------------------------------------------------

  it('GET /api/lists returns paginated list', async () => {
    let response = await router.fetch(API_URL, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    assert.equal(response.status, 200)
    let body = await response.json()
    assert.ok(Array.isArray(body.data), 'should have data array')
    assert.equal(typeof body.hasMore, 'boolean', 'should have hasMore')
    assert.equal(typeof body.offset, 'number', 'should have offset')
  })

  it('GET /api/lists respects offset and limit', async () => {
    let response = await router.fetch(`${API_URL}?offset=0&limit=2`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    assert.equal(response.status, 200)
    let body = await response.json()
    assert.ok(body.data.length <= 2, 'should respect limit')
  })

  // -----------------------------------------------------------------------
  // POST /api/lists — create
  // -----------------------------------------------------------------------

  let createdId: number | null = null

  it('POST /api/lists creates a list', async () => {
    let response = await router.fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        description: 'API test list',
        items: [{ id: '1', label: 'Item A' }],
      }),
    })
    assert.equal(response.status, 200)
    let body = await response.json()
    assert.ok(typeof body.id === 'number', 'should return numeric id')
    assert.equal(body.description, 'API test list')
    createdId = body.id
  })

  it('POST /api/lists without description returns 400', async () => {
    let response = await router.fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ items: [{ id: '1', label: 'Item' }] }),
    })
    assert.equal(response.status, 400)
    let body = await response.json()
    assert.ok(body.error)
  })

  it('POST /api/lists with empty items returns 400', async () => {
    let response = await router.fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ description: 'Test', items: [] }),
    })
    assert.equal(response.status, 400)
    let body = await response.json()
    assert.ok(body.error)
  })

  // -----------------------------------------------------------------------
  // GET /api/lists/:id — show
  // -----------------------------------------------------------------------

  it('GET /api/lists/:id returns a single list', async () => {
    assert.ok(createdId !== null, 'a list must have been created')
    let response = await router.fetch(`${API_URL}/${createdId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    assert.equal(response.status, 200)
    let body = await response.json()
    assert.equal(body.id, createdId)
    assert.equal(body.description, 'API test list')
    assert.ok(Array.isArray(body.items))
  })

  it('GET /api/lists/9999999 returns 404', async () => {
    let response = await router.fetch(`${API_URL}/9999999`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    assert.equal(response.status, 404)
  })

  // -----------------------------------------------------------------------
  // PUT /api/lists/:id — update
  // -----------------------------------------------------------------------

  it('PUT /api/lists/:id updates a list', async () => {
    assert.ok(createdId !== null, 'a list must have been created')
    let response = await router.fetch(`${API_URL}/${createdId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        description: 'Updated API list',
        items: [
          { id: '1', label: 'Updated Item A' },
          { id: '2', label: 'Item B' },
        ],
      }),
    })
    assert.equal(response.status, 200)
    let body = await response.json()
    assert.equal(body.id, createdId)
    assert.equal(body.description, 'Updated API list')
  })

  it('PUT /api/lists/9999999 returns 404', async () => {
    let response = await router.fetch(`${API_URL}/9999999`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        description: 'Test',
        items: [{ id: '1', label: 'Item' }],
      }),
    })
    assert.equal(response.status, 404)
  })

  // -----------------------------------------------------------------------
  // DELETE /api/lists/:id — destroy
  // -----------------------------------------------------------------------

  it('DELETE /api/lists/:id deletes a list', async () => {
    assert.ok(createdId !== null, 'a list must have been created')
    let response = await router.fetch(`${API_URL}/${createdId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    })
    assert.equal(response.status, 200)
    let body = await response.json()
    assert.equal(body.deleted, true)
  })

  it('DELETE /api/lists/9999999 returns 404', async () => {
    let response = await router.fetch(`${API_URL}/9999999`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    })
    assert.equal(response.status, 404)
  })
})
