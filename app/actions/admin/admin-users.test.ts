import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../../test-router.ts'
import { initializeAppDatabase } from '../../data/setup.ts'
import { pool } from '../../data/test-pool.ts'
import { createAuthCookieWithCsrfForUser, createTestUser, extractCookie } from '../../test-utils.ts'

const BASE = 'https://remix.run'
const USERS_URL = `${BASE}/admin/users`

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

    it('filters by enabled users (?filter=enabled)', async () => {
      let disabledEmail = `test-filter-disabled-${Date.now()}@example.com`
      let disabledId = await createTestUser(disabledEmail)
      assert.ok(disabledId, 'test user for disabled filter must be created')
      await pool.query(`UPDATE users SET disabled_at = $1 WHERE id = $2`, [Date.now(), disabledId])

      let response = await router.fetch(`${USERS_URL}?filter=enabled`, {
        headers: { Cookie: adminCookie },
      })
      assert.equal(response.status, 200)
      let text = await response.text()
      assert.ok(!text.includes(disabledEmail), 'disabled user should not appear in enabled filter')
    })

    it('filters by disabled users (?filter=disabled)', async () => {
      let disabledEmail = `test-filter-disabled2-${Date.now()}@example.com`
      let disabledId = await createTestUser(disabledEmail)
      assert.ok(disabledId, 'test user for disabled filter must be created')
      await pool.query(`UPDATE users SET disabled_at = $1 WHERE id = $2`, [Date.now(), disabledId])

      let response = await router.fetch(`${USERS_URL}?filter=disabled`, {
        headers: { Cookie: adminCookie },
      })
      assert.equal(response.status, 200)
      let text = await response.text()
      assert.ok(text.includes(disabledEmail), 'disabled user should appear in disabled filter')
    })

    it('filters by numeric ID (?filter=<id>)', async () => {
      let email = `test-filter-id-${Date.now()}@example.com`
      let id = await createTestUser(email)
      assert.ok(id, 'test user for ID filter must be created')

      let response = await router.fetch(`${USERS_URL}?filter=${id}`, {
        headers: { Cookie: adminCookie },
      })
      assert.equal(response.status, 200)
      let text = await response.text()
      assert.ok(text.includes(email), 'user should appear when filtering by their ID')
    })

    it('returns empty result for nonexistent ID (?filter=9999999)', async () => {
      let response = await router.fetch(`${USERS_URL}?filter=9999999`, {
        headers: { Cookie: adminCookie },
      })
      assert.equal(response.status, 200)
      let text = await response.text()
      assert.ok(
        text.includes('Keine Benutzer'),
        'should show empty state for nonexistent ID',
      )
    })
  })

  describe('create (POST /admin/users)', () => {
    let testEmail: string

    it('creates a new user with valid data', async () => {
      testEmail = `test-create-${Date.now()}@example.com`
      let body = new URLSearchParams({
        name: 'Test Create User',
        email: testEmail,
        role: 'customer',
        password: 'testpass123!',
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
    })

    it('rejects missing name', async () => {
      let body = new URLSearchParams({
        name: '',
        email: `test-noname-${Date.now()}@example.com`,
        role: 'customer',
        password: 'testpass123!',
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
      assert.equal(json.error, 'Invalid form data')
    })

    it('rejects invalid email', async () => {
      let body = new URLSearchParams({
        name: 'Test User',
        email: 'not-an-email',
        role: 'customer',
        password: 'testpass123!',
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
      assert.equal(json.error, 'Invalid form data')
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
      assert.ok(json.error.includes('Passwort'))
    })

    it('rejects duplicate email', async () => {
      let body = new URLSearchParams({
        name: 'Duplicate Test',
        email: 'admin@newapp.com', // already exists
        role: 'customer',
        password: 'testpass123!',
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
        password: 'testpass123!',
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

      let body = new URLSearchParams({
        name: 'Audit User',
        email: `test-audit-${Date.now()}@example.com`,
        role: 'customer',
        password: 'auditpass123!',
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

  describe('toggle-disabled (POST /admin/users/:id/toggle-disabled)', () => {
    it('disables an active user', async () => {
      let email = `test-toggle-off-${Date.now()}@example.com`
      let id = await createTestUser(email)
      assert.ok(id, 'test user must be created')

      let response = await router.fetch(`${BASE}/admin/users/${id}/toggle-disabled`, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/json',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: '{}',
      })
      assert.equal(response.status, 200)
      let json = await response.json()
      assert.equal(json.ok, true)
      assert.equal(json.disabled, true)

      let result = await pool.query('SELECT disabled_at FROM users WHERE id = $1', [id])
      assert.ok(result.rows[0]?.disabled_at != null, 'disabled_at should be set')
    })

    it('enables a disabled user', async () => {
      let email = `test-toggle-on-${Date.now()}@example.com`
      let id = await createTestUser(email)
      assert.ok(id, 'test user must be created')
      await pool.query(`UPDATE users SET disabled_at = $1 WHERE id = $2`, [Date.now(), id])

      let response = await router.fetch(`${BASE}/admin/users/${id}/toggle-disabled`, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/json',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: '{}',
      })
      assert.equal(response.status, 200)
      let json = await response.json()
      assert.equal(json.ok, true)
      assert.equal(json.disabled, false)

      let result = await pool.query('SELECT disabled_at FROM users WHERE id = $1', [id])
      assert.equal(result.rows[0]?.disabled_at, null, 'disabled_at should be null')
    })

    it('returns 404 for non-existent user', async () => {
      let response = await router.fetch(`${BASE}/admin/users/9999999/toggle-disabled`, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/json',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: '{}',
      })
      assert.equal(response.status, 404)
      let json = await response.json()
      assert.equal(json.error, 'User not found')
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

    it('preserves filter=disabled after delete', async () => {
      let email = `test-del-filter-${Date.now()}@example.com`
      let id = await createTestUser(email)
      assert.ok(id, 'test user must be created')
      await pool.query(`UPDATE users SET disabled_at = $1 WHERE id = $2`, [Date.now(), id])

      let body = new URLSearchParams({
        _csrf: adminCsrfToken,
        _offset: '',
        _sort: 'name',
        _order: 'asc',
        _filter: 'disabled',
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
      let location = response.headers.get('Location') || ''
      assert.ok(
        location.includes('filter=disabled'),
        'redirect should preserve filter=disabled, got: ' + location,
      )
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
