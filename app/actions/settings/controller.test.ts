import { describe, it, before, after } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../../test-router.ts'
import { createAuthCookieWithCsrfForUser } from '../../test-utils.ts'
import { routes } from '../../routes.ts'
import { initializeAppDatabase } from '../../db.ts'
import { pool } from '../../data/test-pool.ts'
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
      let h1Count = (html.match(/<h1[\s>]/g) ?? []).length
      assert.equal(
        h1Count,
        1,
        'should render exactly one h1 (the breadcrumb carries the visible page title)',
      )
      assert.ok(html.includes('Passwort ändern'), 'page should contain password section')
      assert.ok(html.includes('name="currentPassword"'), 'should have current password input')
      assert.ok(html.includes('name="newPassword"'), 'should have new password input')
      assert.ok(html.includes('name="confirmPassword"'), 'should have confirm password input')
      assert.ok(html.includes('name="_csrf"'), 'form should include CSRF token input')
      assert.ok(html.includes('role="tablist"'), 'should render the settings tab list')
      assert.ok(
        html.includes('data-settings-active-tab="settings-profile"'),
        'profile tab should be selected by default',
      )
    })

    it('renders the profile summary with role and membership date', async () => {
      let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
      if (!session) throw new Error('Could not create auth session')

      let response = await router.fetch(`${BASE}${routes.settings.index.href()}`, {
        headers: { Cookie: session.cookie },
      })

      assert.equal(response.status, 200)
      let html = await response.text()
      assert.ok(html.includes('data-settings-role="customer"'), 'should show the account role')
      assert.ok(html.includes('Mitglied seit'), 'should label the membership date')
      assert.ok(html.includes('data-settings-member-since'), 'should render the membership date')
    })

    it('renders an ARIA tab and tabpanel for every settings section', async () => {
      let session = await createAuthCookieWithCsrfForUser('user@newapp.com')
      if (!session) throw new Error('Could not create auth session')

      let response = await router.fetch(`${BASE}${routes.settings.index.href()}`, {
        headers: { Cookie: session.cookie },
      })

      assert.equal(response.status, 200)
      let html = await response.text()
      for (let section of ['profile', 'display', 'password', 'account']) {
        assert.ok(html.includes(`id="settings-${section}"`), `should render the ${section} panel`)
        assert.ok(
          html.includes(`href="#settings-${section}"`),
          `should link to the ${section} panel`,
        )
        assert.ok(
          html.includes(`aria-controls="settings-${section}"`),
          `tab should control the ${section} panel`,
        )
        assert.ok(html.includes(`id="settings-${section}-tab"`), `should render the ${section} tab`)
      }
      assert.equal((html.match(/role="tab"/g) ?? []).length, 4, 'should render one tab per section')
      assert.equal(
        (html.match(/role="tabpanel"/g) ?? []).length,
        4,
        'should render one tabpanel per section',
      )
    })

    it('shows the administrator badge for admin accounts', async () => {
      let session = await createAuthCookieWithCsrfForUser('admin@newapp.com')
      if (!session) throw new Error('Could not create auth session')

      let response = await router.fetch(`${BASE}${routes.settings.index.href()}`, {
        headers: { Cookie: session.cookie },
      })

      assert.equal(response.status, 200)
      let html = await response.text()
      assert.ok(html.includes('data-settings-role="admin"'), 'should label the admin role')
      assert.ok(html.includes('Administrator'), 'should render the admin role label')
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
        [
          testUserEmail,
          await hashPassword(INITIAL_PASSWORD),
          'Settings Test User',
          'customer',
          Date.now(),
        ],
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
      assert.ok(
        html.includes('data-settings-active-tab="settings-password"'),
        'should keep the password tab active after a failed change',
      )
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

    it('redirects back to the display tab after saving the page size', async () => {
      let session = await createAuthCookieWithCsrfForUser(testUserEmail)
      if (!session) throw new Error('Could not create auth session')

      let response = await router.fetch(`${BASE}${routes.settings.action.href()}`, {
        method: 'POST',
        headers: { Cookie: session.cookie },
        body: new URLSearchParams({
          _action: 'set-page-size',
          pageSize: '25',
          _csrf: session.csrfToken,
        }),
        redirect: 'manual',
      })

      assert.equal(response.status, 302)
      let location = response.headers.get('Location')
      assert.ok(
        location?.endsWith('#settings-display'),
        'should keep the display tab active after saving',
      )
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
      assert.ok(
        html.includes('Ich möchte mein Konto dauerhaft löschen'),
        'should show confirmation checkbox',
      )
      assert.ok(html.includes('name="_action"'), 'should have action routing hidden field')
      assert.ok(
        html.includes('data-delete-confirm'),
        'confirmation checkbox should carry the client gate hook',
      )
      assert.ok(
        html.includes('data-delete-submit'),
        'destructive submit button should carry the client gate hook',
      )
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
        [
          deleteUserEmail,
          await hashPassword(INITIAL_PASSWORD),
          'Delete Wrong PW',
          'customer',
          Date.now(),
        ],
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
      assert.ok(
        html.includes('data-settings-active-tab="settings-account"'),
        'should keep the account tab active after a failed delete',
      )
    })

    it('successfully deletes account and redirects to login', async () => {
      let deleteUserEmail = `${TEST_PREFIX}delete-success@example.com`
      await pool.query(
        `INSERT INTO users (email, password_hash, name, role, email_verified, created_at)
         VALUES ($1, $2, $3, $4, 1, $5)`,
        [
          deleteUserEmail,
          await hashPassword(INITIAL_PASSWORD),
          'Delete Success',
          'customer',
          Date.now(),
        ],
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
        [
          rateLimitEmail,
          await hashPassword(INITIAL_PASSWORD),
          'Delete Rate Limit',
          'customer',
          Date.now(),
        ],
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

    it(
      'cleans up related records on deletion (messages sender_id set to NULL)',
      { todo: true },
      () => {},
    )
  })
})
