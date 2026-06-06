import { describe, it, before, after } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../../router.ts'
import { createAuthCookieWithCsrfForUser } from '../../test-utils.ts'
import { routes } from '../../routes.ts'
import { initializeAppDatabase, pool } from '../../data/setup.ts'
import { hashPassword } from '../../utils/password-hash.ts'

const BASE = 'https://remix.run'

const TEST_PREFIX = `sett-${Date.now()}-`
const INITIAL_PASSWORD = 'password123'
const NEW_PASSWORD = 'NewSecure1!pass'

/**
 * Test users are created with a stable known password. The first action test
 * changes the password to NEW_PASSWORD. Subsequent tests that need a valid
 * current password use the `currentPassword` variable, which is updated after
 * the change. The ordering is enforced by the test file position.
 */
let currentPassword = INITIAL_PASSWORD

describe('Settings controller', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  describe('GET /settings (index)', () => {
    it('returns the settings page for authenticated user', async () => {
      let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
      if (!session) throw new Error('Could not create auth session')

      let response = await router.fetch(`${BASE}${routes.settings.index.href()}`, {
        headers: { Cookie: session.cookie },
      })

      assert.equal(response.status, 200)
      let html = await response.text()
      assert.ok(html.includes('Settings'), 'page should contain Settings heading')
      assert.ok(html.includes('Password ändern'), 'page should contain password section')
      assert.ok(html.includes('name="currentPassword"'), 'should have current password input')
      assert.ok(html.includes('name="newPassword"'), 'should have new password input')
      assert.ok(html.includes('name="confirmPassword"'), 'should have confirm password input')
      assert.ok(html.includes('name="_csrf"'), 'form should include CSRF token input')
    })

    it('redirects unauthenticated user to login page', async () => {
      let response = await router.fetch(`${BASE}${routes.settings.index.href()}`, {
        redirect: 'manual',
      })

      assert.equal(response.status, 302)
      let location = response.headers.get('Location')
      assert.ok(location?.startsWith(routes.auth.login.index.href()), 'should redirect to login')
    })
  })

  describe('POST /settings (action)', () => {
    let testUserEmail: string

    before(async () => {
      testUserEmail = `${TEST_PREFIX}settings-test@example.com`
      await pool.query(
        `INSERT INTO users (email, password_hash, name, role, email_verified, created_at)
         VALUES ($1, $2, $3, $4, 1, $5)`,
        [testUserEmail, await hashPassword(INITIAL_PASSWORD), 'Settings Test User', 'customer', Date.now()],
      )
    })

    after(async () => {
      await pool.query('DELETE FROM users WHERE email = $1', [testUserEmail])
    })

    it('successfully changes password with valid current password', async () => {
      let session = await createAuthCookieWithCsrfForUser(testUserEmail)
      if (!session) throw new Error('Could not create auth session')

      currentPassword = INITIAL_PASSWORD
      let response = await router.fetch(`${BASE}${routes.settings.action.href()}`, {
        method: 'POST',
        headers: { Cookie: session.cookie },
        body: new URLSearchParams({
          currentPassword,
          newPassword: NEW_PASSWORD,
          confirmPassword: NEW_PASSWORD,
          _csrf: session.csrfToken,
        }),
        redirect: 'manual',
      })

      assert.equal(response.status, 200)
      let html = await response.text()
      assert.ok(html.includes('Password updated successfully'), 'should show success message')

      currentPassword = NEW_PASSWORD
    })

    it('rejects wrong current password', async () => {
      let session = await createAuthCookieWithCsrfForUser(testUserEmail)
      if (!session) throw new Error('Could not create auth session')

      let response = await router.fetch(`${BASE}${routes.settings.action.href()}`, {
        method: 'POST',
        headers: { Cookie: session.cookie },
        body: new URLSearchParams({
          currentPassword: 'wrong-password',
          newPassword: 'Another1!valid',
          confirmPassword: 'Another1!valid',
          _csrf: session.csrfToken,
        }),
        redirect: 'manual',
      })

      assert.equal(response.status, 400)
      let html = await response.text()
      assert.ok(html.includes('Current password is incorrect'), 'should show error')
    })

    it('rejects password that is too short', async () => {
      let session = await createAuthCookieWithCsrfForUser(testUserEmail)
      if (!session) throw new Error('Could not create auth session')

      let response = await router.fetch(`${BASE}${routes.settings.action.href()}`, {
        method: 'POST',
        headers: { Cookie: session.cookie },
        body: new URLSearchParams({
          currentPassword,
          newPassword: 'Ab1!def',
          confirmPassword: 'Ab1!def',
          _csrf: session.csrfToken,
        }),
        redirect: 'manual',
      })

      assert.equal(response.status, 400)
      let html = await response.text()
      assert.ok(html.includes('10 characters'), 'should show length error')
    })

    it('rejects password missing a digit', async () => {
      let session = await createAuthCookieWithCsrfForUser(testUserEmail)
      if (!session) throw new Error('Could not create auth session')

      let response = await router.fetch(`${BASE}${routes.settings.action.href()}`, {
        method: 'POST',
        headers: { Cookie: session.cookie },
        body: new URLSearchParams({
          currentPassword,
          newPassword: 'abcdefghij!',
          confirmPassword: 'abcdefghij!',
          _csrf: session.csrfToken,
        }),
        redirect: 'manual',
      })

      assert.equal(response.status, 400)
      let html = await response.text()
      assert.ok(html.includes('number'), 'should show digit error')
    })

    it('rejects password missing a special character', async () => {
      let session = await createAuthCookieWithCsrfForUser(testUserEmail)
      if (!session) throw new Error('Could not create auth session')

      let response = await router.fetch(`${BASE}${routes.settings.action.href()}`, {
        method: 'POST',
        headers: { Cookie: session.cookie },
        body: new URLSearchParams({
          currentPassword,
          newPassword: 'abcdefghij1',
          confirmPassword: 'abcdefghij1',
          _csrf: session.csrfToken,
        }),
        redirect: 'manual',
      })

      assert.equal(response.status, 400)
      let html = await response.text()
      assert.ok(html.includes('special character'), 'should show special char error')
    })

    it('rejects mismatched passwords', async () => {
      let session = await createAuthCookieWithCsrfForUser(testUserEmail)
      if (!session) throw new Error('Could not create auth session')

      let response = await router.fetch(`${BASE}${routes.settings.action.href()}`, {
        method: 'POST',
        headers: { Cookie: session.cookie },
        body: new URLSearchParams({
          currentPassword,
          newPassword: NEW_PASSWORD,
          confirmPassword: 'Different1!pass',
          _csrf: session.csrfToken,
        }),
        redirect: 'manual',
      })

      assert.equal(response.status, 400)
      let html = await response.text()
      assert.ok(html.includes('Passwords do not match'), 'should show mismatch error')
    })
  })
})
