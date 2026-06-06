import { describe, it, before, after } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../../router.ts'
import { initializeAppDatabase, pool } from '../../data/setup.ts'
import { createAuthCookieWithCsrfForUser, createTestUser, extractCookie } from '../../test-utils.ts'

const BASE = 'https://remix.run'
const USERS_URL = `${BASE}/admin/users`

const createdUserIds: number[] = []

describe('Admin Users Controller', () => {
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

  after(async () => {
    // Clean up created test users
    for (let id of createdUserIds) {
      try {
        await pool.query('DELETE FROM users WHERE id = $1', [id])
      } catch {
        // ignore cleanup errors
      }
    }
    createdUserIds.length = 0
  })

  describe('index (GET /admin/users)', () => {
    it('returns 200 for admin users', async () => {
      let response = await router.fetch(USERS_URL, {
        headers: { Cookie: adminCookie },
      })
      assert.equal(response.status, 200)
      let text = await response.text()
      assert.ok(text.includes('Users') || text.includes('Benutzer'))
    })

    it('returns 403 for non-admin users', async () => {
      let response = await router.fetch(USERS_URL, {
        headers: { Cookie: userCookie },
      })
      assert.equal(response.status, 403)
    })

    it('returns 302 for unauthenticated requests (redirects to login)', async () => {
      let response = await router.fetch(USERS_URL)
      assert.equal(response.status, 302)
    })

    it('supports sorting by name', async () => {
      let response = await router.fetch(`${USERS_URL}?sort=name&order=asc`, {
        headers: { Cookie: adminCookie },
      })
      assert.equal(response.status, 200)
    })

    it('supports sorting by email', async () => {
      let response = await router.fetch(`${USERS_URL}?sort=email&order=desc`, {
        headers: { Cookie: adminCookie },
      })
      assert.equal(response.status, 200)
    })

    it('supports filtering by name', async () => {
      let response = await router.fetch(`${USERS_URL}?filter=Admin`, {
        headers: { Cookie: adminCookie },
      })
      assert.equal(response.status, 200)
    })

    it('supports filtering by email', async () => {
      let response = await router.fetch(`${USERS_URL}?filter=newapp`, {
        headers: { Cookie: adminCookie },
      })
      assert.equal(response.status, 200)
    })

    it('supports pagination', async () => {
      let response = await router.fetch(`${USERS_URL}?offset=0`, {
        headers: { Cookie: adminCookie },
      })
      assert.equal(response.status, 200)
    })

    it('does not expose password_hash in the response', async () => {
      let response = await router.fetch(USERS_URL, {
        headers: { Cookie: adminCookie },
      })
      let text = await response.text()
      assert.ok(!text.includes('password_hash'))
    })
  })

  describe('create (POST /admin/users)', () => {
    let testEmail: string

    after(() => {
      // cleanup is done in the outer after with createdUserIds
    })

    it('creates a new user with valid data', async () => {
      testEmail = `test-create-${Date.now()}@example.com`
      let body = new URLSearchParams({
        name: 'Test Create User',
        email: testEmail,
        role: 'customer',
        password: 'testpass123',
        _csrf: adminCsrfToken,
      })
      let response = await router.fetch(USERS_URL, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      })
      // Should redirect to editing mode
      assert.equal(response.status, 302)
      let location = response.headers.get('Location') || ''
      assert.ok(location.startsWith('/admin/users?editing='))

      // Extract created user ID from query params and add to cleanup list
      let match = location.match(/editing=(\d+)/)
      if (match) {
        createdUserIds.push(Number(match[1]))
      }
    })

    it('rejects missing name', async () => {
      let body = new URLSearchParams({
        name: '',
        email: `test-noname-${Date.now()}@example.com`,
        role: 'customer',
        password: 'testpass123',
        _csrf: adminCsrfToken,
      })
      let response = await router.fetch(USERS_URL, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      })
      assert.equal(response.status, 400)
      let json = await response.json()
      assert.ok(json.error.includes('Name'))
    })

    it('rejects invalid email', async () => {
      let body = new URLSearchParams({
        name: 'Test User',
        email: 'not-an-email',
        role: 'customer',
        password: 'testpass123',
        _csrf: adminCsrfToken,
      })
      let response = await router.fetch(USERS_URL, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      })
      assert.equal(response.status, 400)
      let json = await response.json()
      assert.ok(json.error.includes('email'))
    })

    it('rejects short password', async () => {
      let body = new URLSearchParams({
        name: 'Test User',
        email: `test-shortpwd-${Date.now()}@example.com`,
        role: 'customer',
        password: '12345',
        _csrf: adminCsrfToken,
      })
      let response = await router.fetch(USERS_URL, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      })
      assert.equal(response.status, 400)
      let json = await response.json()
      assert.ok(json.error.includes('Password'))
    })

    it('rejects duplicate email', async () => {
      let body = new URLSearchParams({
        name: 'Duplicate Test',
        email: 'admin@newapp.com', // already exists
        role: 'customer',
        password: 'testpass123',
        _csrf: adminCsrfToken,
      })
      let response = await router.fetch(USERS_URL, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      })
      assert.equal(response.status, 400)
      let json = await response.json()
      assert.ok(json.error.includes('Email already exists') || json.error.includes('exist'))
    })

    it('creates admin role user when specified', async () => {
      let email = `test-admin-${Date.now()}@example.com`
      let body = new URLSearchParams({
        name: 'Test Admin',
        email,
        role: 'admin',
        password: 'testpass123',
        _csrf: adminCsrfToken,
      })
      let response = await router.fetch(USERS_URL, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      })
      assert.equal(response.status, 302)
      let location = response.headers.get('Location') || ''
      let match = location.match(/editing=(\d+)/)
      if (match) {
        let id = Number(match[1])
        createdUserIds.push(id)
        // Verify role is admin
        let result = await pool.query('SELECT role FROM users WHERE id = $1', [id])
        assert.equal(result.rows[0]?.role, 'admin')
      }
    })
  })

  describe('update (PUT /admin/users/:id)', () => {
    let testUserId: number

    before(async () => {
      let id = await createTestUser(`test-update-${Date.now()}@example.com`)
      if (!id) throw new Error('Failed to create test user for update')
      testUserId = id
      createdUserIds.push(testUserId)
    })

    it('updates a user name', async () => {
      let body = new URLSearchParams({
        name: 'Updated Name',
        email: `test-update-${Date.now()}@example.com`,
        role: 'customer',
        _csrf: adminCsrfToken,
        _offset: '',
        _sort: '',
        _order: '',
        _filter: '',
      })
      let response = await router.fetch(`${BASE}/admin/users/${testUserId}`, {
        method: 'PUT',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
      })
      assert.equal(response.status, 302)
      assert.ok((response.headers.get('Location') || '').startsWith('/admin/users'))
    })

    it('rejects update with invalid email', async () => {
      let body = new URLSearchParams({
        name: 'Test User',
        email: 'bad-email',
        role: 'customer',
        _csrf: adminCsrfToken,
        _offset: '',
        _sort: '',
        _order: '',
        _filter: '',
      })
      let response = await router.fetch(`${BASE}/admin/users/${testUserId}`, {
        method: 'PUT',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
      })
      assert.equal(response.status, 400)
    })

    it('redacts password_hash from audit log details', async () => {
      let id = await createTestUser(`test-audit-${Date.now()}@example.com`)
      if (!id) throw new Error('Failed to create test user for audit test')
      createdUserIds.push(id)

      let body = new URLSearchParams({
        name: 'Audit User',
        email: `test-audit-${Date.now()}@example.com`,
        role: 'customer',
        password: 'auditpass123',
        _csrf: adminCsrfToken,
        _offset: '',
        _sort: '',
        _order: '',
        _filter: '',
      })
      let response = await router.fetch(`${BASE}/admin/users/${id}`, {
        method: 'PUT',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
      })
      assert.equal(response.status, 302, 'update should redirect on success')

      let result = await pool.query(
        `SELECT details, action_type, target_id, target_type FROM audit_logs
         WHERE target_type = 'users'
           AND target_id = $1
           AND action_type = 'update'
         ORDER BY created_at DESC LIMIT 1`,
        [String(id)],
      )

      assert.ok(result.rows.length > 0, `audit log entry must exist for user ${id}`)
      let row = result.rows[0]
      assert.equal(row.action_type, 'update')
      assert.equal(row.target_type, 'users')

      let details = row.details
      if (typeof details === 'string') {
        details = JSON.parse(details)
      }
      assert.ok(details != null, 'details should not be null')
      let changes = (details as any).changes as Record<string, unknown> | undefined
      assert.ok(changes != null, 'changes should be present')
      assert.equal(
        changes?.password_hash,
        '***REDACTED***',
        'password_hash must be redacted in audit log',
      )
    })
  })

  describe('destroy (DELETE /admin/users/:id)', () => {
    it('deletes an existing user', async () => {
      let id = await createTestUser(`test-delete-${Date.now()}@example.com`)
      if (!id) throw new Error('Failed to create test user for delete')

      let body = new URLSearchParams({
        _csrf: adminCsrfToken,
        _offset: '',
        _sort: '',
        _order: '',
        _filter: '',
      })
      let response = await router.fetch(`${BASE}/admin/users/${id}`, {
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

    it('returns 404 for non-existent user', async () => {
      let body = new URLSearchParams({
        _csrf: adminCsrfToken,
        _offset: '',
        _sort: '',
        _order: '',
        _filter: '',
      })
      let response = await router.fetch(`${BASE}/admin/users/9999999`, {
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
      let response = await router.fetch(`${BASE}/admin/users/1`, {
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
