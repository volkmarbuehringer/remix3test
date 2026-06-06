import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../../router.ts'
import { createCsrfSession } from '../../test-utils.ts'
import { routes } from '../../routes.ts'
import { pool, initializeAppDatabase } from '../../data/setup.ts'

const BASE = 'https://remix.run'

const TEST_PREFIX = `frgt-${Date.now()}-`

describe('Auth Forgot Password controller', () => {
  before(async () => {
    await initializeAppDatabase()
  })
  describe('index (GET /auth/forgotten)', () => {
    it('returns the forgot password form', async () => {
      let response = await router.fetch(`${BASE}${routes.auth.forgotten.index.href()}`)

      assert.equal(response.status, 200)
      let html = await response.text()

      assert.ok(html.includes('Forgot your password?'), 'page should contain heading')
      assert.ok(html.includes('<form'), 'page should contain a form element')
      assert.ok(html.includes('method="POST"'), 'form method should be POST')
      assert.ok(html.includes('name="email"'), 'should have email input')
      assert.ok(html.includes('type="submit"'), 'should have submit button')
      assert.ok(html.includes('Send reset link'), 'should have send-reset-link button text')
      assert.ok(html.includes('name="_csrf"'), 'form should include CSRF token input')
    })
  })

  describe('POST /auth/forgotten (action)', () => {
    it('with valid existing email returns success page', async () => {
      let { cookie, csrfToken } = await createCsrfSession(`${BASE}${routes.auth.forgotten.index.href()}`)

      let response = await router.fetch(`${BASE}${routes.auth.forgotten.action.href()}`, {
        method: 'POST',
        headers: { Cookie: cookie },
        body: new URLSearchParams({
          email: 'user@newapp.com',
          _csrf: csrfToken,
        }),
        redirect: 'manual',
      })

      assert.equal(response.status, 200)
      let html = await response.text()
      assert.ok(html.includes('Check your email'), 'should show success message')
      assert.ok(html.includes('sent a password reset link'), 'should mention reset link sent')
    })

    it('with non-existing email returns same success page (no user enumeration)', async () => {
      let { cookie, csrfToken } = await createCsrfSession(`${BASE}${routes.auth.forgotten.index.href()}`)

      let response = await router.fetch(`${BASE}${routes.auth.forgotten.action.href()}`, {
        method: 'POST',
        headers: { Cookie: cookie },
        body: new URLSearchParams({
          email: `nonexistent-${Date.now()}@example.com`,
          _csrf: csrfToken,
        }),
        redirect: 'manual',
      })

      assert.equal(response.status, 200)
      let html = await response.text()
      assert.ok(html.includes('Check your email'), 'should show same success message')
      assert.ok(html.includes('sent a password reset link'), 'should mention reset link sent')
    })

    it('with invalid email format returns validation error', async () => {
      let { cookie, csrfToken } = await createCsrfSession(`${BASE}${routes.auth.forgotten.index.href()}`)

      let response = await router.fetch(`${BASE}${routes.auth.forgotten.action.href()}`, {
        method: 'POST',
        headers: { Cookie: cookie },
        body: new URLSearchParams({
          email: 'not-an-email',
          _csrf: csrfToken,
        }),
        redirect: 'manual',
      })

      assert.equal(response.status, 400)
      let html = await response.text()
      assert.ok(html.includes('valid email'), 'should show validation error')
    })

    it('rate limits after too many attempts', async () => {
      let email = `${TEST_PREFIX}ratelimit@example.com`

      for (let i = 0; i < 5; i++) {
        let session = await createCsrfSession(`${BASE}${routes.auth.forgotten.index.href()}`)
        await router.fetch(`${BASE}${routes.auth.forgotten.action.href()}`, {
          method: 'POST',
          headers: { Cookie: session.cookie },
          body: new URLSearchParams({
            email,
            _csrf: session.csrfToken,
          }),
          redirect: 'manual',
        })
      }

      let finalSession = await createCsrfSession(`${BASE}${routes.auth.forgotten.index.href()}`)
      let response = await router.fetch(`${BASE}${routes.auth.forgotten.action.href()}`, {
        method: 'POST',
        headers: { Cookie: finalSession.cookie },
        body: new URLSearchParams({
          email,
          _csrf: finalSession.csrfToken,
        }),
        redirect: 'manual',
      })

      assert.equal(response.status, 429, 'should return 429 when rate limited')
    })
  })

  describe('GET /auth/forgotten/:token (reset form)', () => {
    it('with valid token renders reset form', async () => {
      let email = `${TEST_PREFIX}validtoken@example.com`
      let token = 'valid-reset-token-' + Date.now()
      let expires = Date.now() + 3600000

      await pool.query(
        `INSERT INTO users (email, password_hash, name, role, email_verified, created_at, password_reset_token, password_reset_expires)
         VALUES ($1, $2, $3, $4, 1, $5, $6, $7)
         ON CONFLICT (email) DO UPDATE SET password_reset_token = $6, password_reset_expires = $7`,
        [email, 'old-hash', 'Valid Token User', 'customer', Date.now(), token, expires],
      )

      let response = await router.fetch(`${BASE}${routes.auth.forgottenReset.index.href({ token })}`)

      assert.equal(response.status, 200)
      let html = await response.text()

      assert.ok(html.includes('Set a new password'), 'should contain reset heading')
      assert.ok(html.includes('name="password"'), 'should have password input')
      assert.ok(html.includes('name="confirmPassword"'), 'should have confirm password input')
      assert.ok(html.includes('Reset password'), 'should have reset button')
      assert.ok(html.includes('name="_csrf"'), 'form should include CSRF token input')
    })

    it('with expired token shows error', async () => {
      let email = `${TEST_PREFIX}expired@example.com`
      let token = 'expired-token-' + Date.now()
      let expires = Date.now() - 1000

      await pool.query(
        `INSERT INTO users (email, password_hash, name, role, email_verified, created_at, password_reset_token, password_reset_expires)
         VALUES ($1, $2, $3, $4, 1, $5, $6, $7)
         ON CONFLICT (email) DO UPDATE SET password_reset_token = $6, password_reset_expires = $7`,
        [email, 'old-hash', 'Expired User', 'customer', Date.now(), token, expires],
      )

      let response = await router.fetch(`${BASE}${routes.auth.forgottenReset.index.href({ token })}`)

      assert.equal(response.status, 400)
      let html = await response.text()
      assert.ok(html.includes('expired'), 'should show expired error')
    })

    it('with unknown token shows error', async () => {
      let response = await router.fetch(`${BASE}${routes.auth.forgottenReset.index.href({ token: 'nonexistent-token-xyz' })}`)

      assert.equal(response.status, 400)
      let html = await response.text()
      assert.ok(html.includes('Invalid reset link'), 'should show invalid link error')
    })
  })

  describe('POST /auth/forgotten/:token (reset action)', () => {
    it('with valid token and password redirects to login', async () => {
      let email = `${TEST_PREFIX}reset@example.com`
      let token = 'reset-action-token-' + Date.now()
      let expires = Date.now() + 3600000

      await pool.query(
        `INSERT INTO users (email, password_hash, name, role, email_verified, created_at, password_reset_token, password_reset_expires)
         VALUES ($1, $2, $3, $4, 1, $5, $6, $7)
         ON CONFLICT (email) DO UPDATE SET password_reset_token = $6, password_reset_expires = $7`,
        [email, 'old-hash', 'Reset Test User', 'customer', Date.now(), token, expires],
      )

      let { cookie, csrfToken } = await createCsrfSession(
        `${BASE}${routes.auth.forgottenReset.index.href({ token })}`,
      )

      let response = await router.fetch(
        `${BASE}${routes.auth.forgottenReset.action.href({ token })}`,
        {
          method: 'POST',
          headers: { Cookie: cookie },
          body: new URLSearchParams({
            password: 'newSecurePassword123!',
            confirmPassword: 'newSecurePassword123!',
            _csrf: csrfToken,
          }),
          redirect: 'manual',
        },
      )

      assert.equal(response.status, 302, 'should redirect on success')
      assert.equal(response.headers.get('Location'), routes.auth.login.index.href(), 'should redirect to login')

      let result = await pool.query(
        'SELECT password_reset_token, password_reset_expires FROM users WHERE email = $1',
        [email],
      )
      assert.equal(result.rows[0].password_reset_token, null, 'token should be cleared')
      assert.equal(result.rows[0].password_reset_expires, null, 'expires should be cleared')
    })

    it('with short password shows validation error', async () => {
      let email = `${TEST_PREFIX}shortpw@example.com`
      let token = 'short-pw-token-' + Date.now()
      let expires = Date.now() + 3600000

      await pool.query(
        `INSERT INTO users (email, password_hash, name, role, email_verified, created_at, password_reset_token, password_reset_expires)
         VALUES ($1, $2, $3, $4, 1, $5, $6, $7)
         ON CONFLICT (email) DO UPDATE SET password_reset_token = $6, password_reset_expires = $7`,
        [email, 'old-hash', 'Short PW Test User', 'customer', Date.now(), token, expires],
      )

      let { cookie, csrfToken } = await createCsrfSession(
        `${BASE}${routes.auth.forgottenReset.index.href({ token })}`,
      )

      let response = await router.fetch(
        `${BASE}${routes.auth.forgottenReset.action.href({ token })}`,
        {
          method: 'POST',
          headers: { Cookie: cookie },
          body: new URLSearchParams({
            password: 'short',
            confirmPassword: 'short',
            _csrf: csrfToken,
          }),
          redirect: 'manual',
        },
      )

      assert.equal(response.status, 400)
      let html = await response.text()
      assert.ok(html.includes('mindestens 10'), 'should show password length error')
    })

    it('with mismatched passwords shows error', async () => {
      let email = `${TEST_PREFIX}mismatch@example.com`
      let token = 'mismatch-token-' + Date.now()
      let expires = Date.now() + 3600000

      await pool.query(
        `INSERT INTO users (email, password_hash, name, role, email_verified, created_at, password_reset_token, password_reset_expires)
         VALUES ($1, $2, $3, $4, 1, $5, $6, $7)
         ON CONFLICT (email) DO UPDATE SET password_reset_token = $6, password_reset_expires = $7`,
        [email, 'old-hash', 'Mismatch Test User', 'customer', Date.now(), token, expires],
      )

      let { cookie, csrfToken } = await createCsrfSession(
        `${BASE}${routes.auth.forgottenReset.index.href({ token })}`,
      )

      let response = await router.fetch(
        `${BASE}${routes.auth.forgottenReset.action.href({ token })}`,
        {
          method: 'POST',
          headers: { Cookie: cookie },
          body: new URLSearchParams({
            password: 'correctPassword123!',
            confirmPassword: 'differentPassword456!',
            _csrf: csrfToken,
          }),
          redirect: 'manual',
        },
      )

      assert.equal(response.status, 400)
      let html = await response.text()
      assert.ok(html.includes('stimmen nicht überein'), 'should show mismatch error')
    })

    it('with already-used token shows error', async () => {
      let { cookie, csrfToken } = await createCsrfSession(`${BASE}${routes.auth.forgotten.index.href()}`)
      let token = 'used-token-' + Date.now()

      let response = await router.fetch(
        `${BASE}${routes.auth.forgottenReset.action.href({ token })}`,
        {
          method: 'POST',
          headers: { Cookie: cookie },
          body: new URLSearchParams({
            password: 'password12345!',
            confirmPassword: 'password12345!',
            _csrf: csrfToken,
          }),
          redirect: 'manual',
        },
      )

      assert.equal(response.status, 400)
      let html = await response.text()
      assert.ok(html.includes('Invalid reset link'), 'should show invalid link error')
    })
  })
})
