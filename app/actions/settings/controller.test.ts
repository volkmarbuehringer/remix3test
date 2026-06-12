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
      assert.ok(html.includes('Einstellungen'), 'page should contain Einstellungen heading')
      assert.ok(html.includes('Passwort ändern'), 'page should contain password section')
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
      assert.ok(html.includes('Passwort erfolgreich aktualisiert'), 'should show success message')

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
      assert.ok(html.includes('Aktuelles Passwort ist falsch'), 'should show error')
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
      assert.ok(html.includes('10 Zeichen'), 'should show length error')
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
      assert.ok(html.includes('Zahl'), 'should show digit error')
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
      assert.ok(html.includes('Sonderzeichen'), 'should show special char error')
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
      assert.ok(html.includes('Passwörter stimmen nicht überein'), 'should show mismatch error')
    })
  })

  describe('DELETE ACCOUNT', () => {
    it('renders delete account section on settings page', async () => {
      let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
      if (!session) throw new Error('Could not create auth session')

      let response = await router.fetch(`${BASE}${routes.settings.index.href()}`, {
        headers: { Cookie: session.cookie },
      })

      assert.equal(response.status, 200)
      let html = await response.text()
      assert.ok(html.includes('Konto löschen'), 'page should contain delete account section')
      assert.ok(html.includes('löscht Ihr Konto'), 'should show warning about permanent deletion')
      assert.ok(html.includes('Wollen Sie wirklich löschen'), 'should show confirmation checkbox')
      assert.ok(html.includes('name="_action"'), 'should have action routing hidden field')
    })

    it('rejects delete account for admin users', async () => {
      let session = await createAuthCookieWithCsrfForUser('admin@newapp.com')
      if (!session) throw new Error('Could not create auth session')

      let response = await router.fetch(`${BASE}${routes.settings.action.href()}`, {
        method: 'POST',
        headers: { Cookie: session.cookie },
        body: new URLSearchParams({
          _action: 'delete-account',
          currentPassword: INITIAL_PASSWORD,
          _csrf: session.csrfToken,
        }),
        redirect: 'manual',
      })

      assert.equal(response.status, 403)
      let html = await response.text()
      assert.ok(html.includes('Administratoren'), 'should show admin restriction error')
    })

    it('rejects delete account with incorrect password', async () => {
      let deleteUserEmail = `${TEST_PREFIX}delete-wrong-pw@example.com`
      await pool.query(
        `INSERT INTO users (email, password_hash, name, role, email_verified, created_at)
         VALUES ($1, $2, $3, $4, 1, $5)`,
        [deleteUserEmail, await hashPassword(INITIAL_PASSWORD), 'Delete Wrong PW', 'customer', Date.now()],
      )

      let session = await createAuthCookieWithCsrfForUser(deleteUserEmail)
      if (!session) throw new Error('Could not create auth session')

      let response = await router.fetch(`${BASE}${routes.settings.action.href()}`, {
        method: 'POST',
        headers: { Cookie: session.cookie },
        body: new URLSearchParams({
          _action: 'delete-account',
          currentPassword: 'wrong-password',
          _csrf: session.csrfToken,
        }),
        redirect: 'manual',
      })

      assert.equal(response.status, 400)
      let html = await response.text()
      assert.ok(html.includes('Aktuelles Passwort ist falsch'), 'should show password error')
    })

    it('successfully deletes account and redirects to login', async () => {
      let deleteUserEmail = `${TEST_PREFIX}delete-success@example.com`
      await pool.query(
        `INSERT INTO users (email, password_hash, name, role, email_verified, created_at)
         VALUES ($1, $2, $3, $4, 1, $5)`,
        [deleteUserEmail, await hashPassword(INITIAL_PASSWORD), 'Delete Success', 'customer', Date.now()],
      )

      let session = await createAuthCookieWithCsrfForUser(deleteUserEmail)
      if (!session) throw new Error('Could not create auth session')

      let response = await router.fetch(`${BASE}${routes.settings.action.href()}`, {
        method: 'POST',
        headers: { Cookie: session.cookie },
        body: new URLSearchParams({
          _action: 'delete-account',
          currentPassword: INITIAL_PASSWORD,
          _csrf: session.csrfToken,
        }),
        redirect: 'manual',
      })

      assert.equal(response.status, 302)
      let location = response.headers.get('Location')
      assert.ok(location?.includes(routes.auth.login.index.href()), 'should redirect to login')

      let userResult = await pool.query('SELECT id FROM users WHERE email = $1', [deleteUserEmail])
      assert.equal(userResult.rows.length, 0, 'user should be deleted from database')
    })

    it('rate limits excessive delete account attempts', async () => {
      let rateLimitEmail = `${TEST_PREFIX}delete-ratelimit@example.com`
      await pool.query(
        `INSERT INTO users (email, password_hash, name, role, email_verified, created_at)
         VALUES ($1, $2, $3, $4, 1, $5)`,
        [rateLimitEmail, await hashPassword(INITIAL_PASSWORD), 'Delete Rate Limit', 'customer', Date.now()],
      )

      let session = await createAuthCookieWithCsrfForUser(rateLimitEmail)
      if (!session) throw new Error('Could not create auth session')

      for (let i = 0; i < 4; i++) {
        let r = await router.fetch(`${BASE}${routes.settings.action.href()}`, {
          method: 'POST',
          headers: { Cookie: session.cookie },
          body: new URLSearchParams({
            _action: 'delete-account',
            currentPassword: 'wrong-password',
            _csrf: session.csrfToken,
          }),
          redirect: 'manual',
        })
        if (i < 3) {
          assert.equal(r.status, 400, `attempt ${i + 1} should be 400`)
        } else {
          assert.equal(r.status, 429, `attempt ${i + 1} should be rate-limited`)
        }
      }
    })

    it('cleans up related records on deletion (messages sender_id set to NULL)', { todo: true }, () => {})
  })
})
