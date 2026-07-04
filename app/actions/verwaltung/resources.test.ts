import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../../test-router.ts'
import { initializeAppDatabase, pool } from '../../data/setup.ts'
import { createAuthCookieWithCsrfForUser, extractCookie } from '../../test-utils.ts'

const BASE = 'https://remix.run'
const RESOURCES_URL = `${BASE}/verwaltung/resources`

describe('Admin Resources Controller', () => {
  let adminCookie: string
  let adminCsrfToken: string
  let userCookie: string
  let userCsrfToken: string

  before(async () => {
    await initializeAppDatabase()

    // Admin session
    let adminAuth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    if (!adminAuth?.cookie) {
      throw new Error('Failed to create admin session')
    }
    adminCookie = adminAuth.cookie
    adminCsrfToken = adminAuth.csrfToken

    // Non-admin user session
    let userAuth = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!userAuth?.cookie) {
      throw new Error('Failed to create user session')
    }
    userCookie = userAuth.cookie
    userCsrfToken = userAuth.csrfToken
  })

  describe('index (GET /verwaltung/resources)', () => {
    it('returns 200 for admin users', async () => {
      let response = await router.fetch(RESOURCES_URL, {
        headers: { Cookie: adminCookie },
      })
      assert.equal(response.status, 200)
      let text = await response.text()
      assert.ok(text.includes('Resources') || text.includes('Ressourcen'))
    })

    it('returns 403 for non-admin users', async () => {
      let response = await router.fetch(RESOURCES_URL, {
        headers: { Cookie: userCookie },
      })
      assert.equal(response.status, 403)
    })

    it('returns 302 for unauthenticated requests', async () => {
      let response = await router.fetch(RESOURCES_URL)
      assert.equal(response.status, 302)
    })

    it('supports filtering by description', async () => {
      let response = await router.fetch(`${RESOURCES_URL}?filter=resource1`, {
        headers: { Cookie: adminCookie },
      })
      assert.equal(response.status, 200)
    })

    it('supports sorting by description', async () => {
      let response = await router.fetch(`${RESOURCES_URL}?sort=description&order=asc`, {
        headers: { Cookie: adminCookie },
      })
      assert.equal(response.status, 200)
    })

    it('supports pagination', async () => {
      let response = await router.fetch(`${RESOURCES_URL}?offset=0`, {
        headers: { Cookie: adminCookie },
      })
      assert.equal(response.status, 200)
    })
  })

  describe('create (POST /verwaltung/resources)', () => {
    it('creates a new resource with valid data', async () => {
      let desc = `Test Resource ${Date.now()}`
      let body = new URLSearchParams({
        name: 'Test Raum',
        description: desc,
        _csrf: adminCsrfToken,
        _offset: '',
        _sort: '',
        _order: '',
        _filter: '',
      })
      let response = await router.fetch(RESOURCES_URL, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      })
      assert.equal(response.status, 302)
      let location = response.headers.get('Location') || ''
      assert.ok(location.startsWith('/verwaltung/resources?editing='))

      let match = location.match(/editing=(\d+)/)
    })

    it('rejects empty description', async () => {
      let body = new URLSearchParams({
        name: 'Test Raum',
        description: '',
        _csrf: adminCsrfToken,
        _offset: '',
        _sort: '',
        _order: '',
        _filter: '',
      })
      let response = await router.fetch(RESOURCES_URL, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      })
      assert.equal(response.status, 400)
      let text = await response.text()
      assert.ok(text.includes('mindestens 8 Zeichen'))
    })

    it('denies create for non-admin users', async () => {
      let body = new URLSearchParams({
        description: 'Unauthorized Resource',
        _csrf: userCsrfToken,
      })
      let response = await router.fetch(RESOURCES_URL, {
        method: 'POST',
        headers: {
          Cookie: userCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      })
      assert.equal(response.status, 403)
    })
  })

  describe('update (PUT /verwaltung/resources/:id)', () => {
    let testResourceId: number

    before(async () => {
      let now = Date.now()
      let result = await pool.query(
        'INSERT INTO resources (name, description, created_at, updated_at) VALUES ($1, $2, $3, $4) RETURNING id',
        ['Test Update', `Test Resource Update ${now}`, now, now],
      )
      testResourceId = result.rows[0].id as number
    })

    it('updates a resource description', async () => {
      let body = new URLSearchParams({
        name: 'Test Update',
        description: 'Updated Description',
        _csrf: adminCsrfToken,
        _offset: '',
        _sort: '',
        _order: '',
        _filter: '',
      })
      let response = await router.fetch(`${BASE}/verwaltung/resources/${testResourceId}`, {
        method: 'PUT',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
      })
      assert.equal(response.status, 302)
      let location = response.headers.get('Location') || ''
      assert.ok(location.startsWith('/verwaltung/resources'))

      // Verify the description was updated
      let result = await pool.query('SELECT description FROM resources WHERE id = $1', [testResourceId])
      assert.equal(result.rows[0]?.description, 'Updated Description')
    })

    it('rejects update with empty description', async () => {
      let body = new URLSearchParams({
        name: 'Test Update',
        description: '',
        _csrf: adminCsrfToken,
        _offset: '',
        _sort: '',
        _order: '',
        _filter: '',
      })
      let response = await router.fetch(`${BASE}/verwaltung/resources/${testResourceId}`, {
        method: 'PUT',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
      })
      assert.equal(response.status, 400)
      let text = await response.text()
      assert.ok(text.includes('mindestens 8 Zeichen'))
    })
  })

  describe('destroy (DELETE /verwaltung/resources/:id)', () => {
    it('deletes a resource with no appointments', async () => {
      let now = Date.now()
      let result = await pool.query(
        'INSERT INTO resources (name, description, created_at, updated_at) VALUES ($1, $2, $3, $4) RETURNING id',
        ['Delete Test', `Delete Test ${now}`, now, now],
      )
      let id = result.rows[0].id as number

      let body = new URLSearchParams({
        _csrf: adminCsrfToken,
        _offset: '',
        _sort: '',
        _order: '',
        _filter: '',
      })
      let response = await router.fetch(`${BASE}/verwaltung/resources/${id}`, {
        method: 'DELETE',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
      })
      assert.equal(response.status, 302)
    })

    it('returns 404 for non-existent resource', async () => {
      let body = new URLSearchParams({
        _csrf: adminCsrfToken,
        _offset: '',
        _sort: '',
        _order: '',
        _filter: '',
      })
      let response = await router.fetch(`${BASE}/verwaltung/resources/9999999`, {
        method: 'DELETE',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
      })
      assert.equal(response.status, 404)
    })

    it('denies delete for non-admin users', async () => {
      let body = new URLSearchParams({
        _csrf: userCsrfToken,
      })
      let response = await router.fetch(`${BASE}/verwaltung/resources/1`, {
        method: 'DELETE',
        headers: {
          Cookie: userCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': userCsrfToken,
        },
        body: body.toString(),
      })
      assert.equal(response.status, 403)
    })
  })
})
