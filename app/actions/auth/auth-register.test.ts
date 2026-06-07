import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../../router.ts'
import { createCsrfSession } from '../../test-utils.ts'
import { routes } from '../../routes.ts'

const BASE = 'https://remix.run'

// ---------------------------------------------------------------------------
// Auth Register Controller integration tests
// Requires a running PostgreSQL database seeded with demo users.
// See newapp/app/data/setup.ts for seed data.
// ---------------------------------------------------------------------------

// Use unique email prefix to avoid conflicts between test runs
const TEST_PREFIX = `test-${Date.now()}-`

describe('Auth Register controller', () => {
  // -----------------------------------------------------------------------
  // GET /register — page rendering
  // -----------------------------------------------------------------------
  it('GET /register returns the register page with form', async () => {
    let response = await router.fetch(`${BASE}${routes.auth.register.index.href()}`)

    assert.equal(response.status, 200)
    let html = await response.text()

    // Page structure
    assert.ok(html.includes('Register'), 'page should contain "Register" heading')
    assert.ok(html.includes('<form'), 'page should contain a form element')
    assert.ok(html.includes('method="POST"'), 'form method should be POST')

    // Form fields
    assert.ok(html.includes('name="name"'), 'should have name input')
    assert.ok(html.includes('name="email"'), 'should have email input')
    assert.ok(html.includes('name="password"'), 'should have password input')
    assert.ok(html.includes('type="email"'), 'should have email type input')
    assert.ok(html.includes('type="password"'), 'should have password type input')

    // Submit button
    assert.ok(html.includes('type="submit"'), 'should have submit button')
    assert.ok(html.includes('Register'), 'button/link text should include Register')

    // CSRF token
    assert.ok(html.includes('name="_csrf"'), 'form should include CSRF token input')
  })

  // -----------------------------------------------------------------------
  // POST /register — successful registration
  // -----------------------------------------------------------------------
  it('POST /register with valid data creates user and redirects to register-sent', async () => {
    let { cookie, csrfToken } = await createCsrfSession(`${BASE}${routes.auth.register.index.href()}`)
    let email = `${TEST_PREFIX}valid@example.com`

    let response = await router.fetch(`${BASE}${routes.auth.register.index.href()}`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: new URLSearchParams({
        name: 'Test User',
        email,
        password: 'securePassword123!',
        confirmPassword: 'securePassword123!',
        _csrf: csrfToken,
      }),
      redirect: 'manual',
    })

    assert.equal(response.status, 302, 'should redirect on success')
    assert.equal(response.headers.get('Location'), routes.auth.registerSent.href(), 'should redirect to register-sent page')
  })

  // -----------------------------------------------------------------------
  // POST /register — duplicate email
  // -----------------------------------------------------------------------
  it('POST /register with duplicate email returns 400 with error', async () => {
    let { cookie, csrfToken } = await createCsrfSession(`${BASE}${routes.auth.register.index.href()}`)
    let email = `${TEST_PREFIX}duplicate@example.com`

    // Create the user first
    let createResponse = await router.fetch(`${BASE}${routes.auth.register.index.href()}`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: new URLSearchParams({
        name: 'First User',
        email,
        password: 'password123!',
        confirmPassword: 'password123!',
        _csrf: csrfToken,
      }),
      redirect: 'manual',
    })
    assert.equal(createResponse.status, 302, 'first creation should succeed')

    // Try to register again with the same email (reuse same cookie + token)
    let response = await router.fetch(`${BASE}${routes.auth.register.index.href()}`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: new URLSearchParams({
        name: 'Second User',
        email,
        password: 'otherpass456!',
        confirmPassword: 'otherpass456!',
        _csrf: csrfToken,
      }),
      redirect: 'manual',
    })

    assert.equal(response.status, 400, 'duplicate should return 400')
    let html = await response.text()
    assert.ok(html.includes('existiert bereits'), 'should show duplicate email error')
  })

  // -----------------------------------------------------------------------
  // POST /register — invalid field handling
  //
  // The register controller now validates form data client-side before
  // hitting the database. Invalid fields return 400 with an error message.
  // -----------------------------------------------------------------------
  it('POST /register with empty name returns 400 with error message', async () => {
    let { cookie, csrfToken } = await createCsrfSession(`${BASE}${routes.auth.register.index.href()}`)
    let email = `${TEST_PREFIX}emptyname@example.com`

    let response = await router.fetch(`${BASE}${routes.auth.register.index.href()}`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: new URLSearchParams({
        name: '',
        email,
        password: 'password123!',
        confirmPassword: 'password123!',
        _csrf: csrfToken,
      }),
      redirect: 'manual',
    })

    assert.equal(response.status, 400)
    let html = await response.text()
    assert.ok(html.includes('Ungültige Eingabe'), 'should show validation error for empty name')
    assert.ok(html.includes('<span id="name-error"'), 'should show name field error')
  })

  it('POST /register with empty email returns 400 with error message', async () => {
    let { cookie, csrfToken } = await createCsrfSession(`${BASE}${routes.auth.register.index.href()}`)

    let response = await router.fetch(`${BASE}${routes.auth.register.index.href()}`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: new URLSearchParams({
        name: 'Test User',
        email: '',
        password: 'password123!',
        confirmPassword: 'password123!',
        _csrf: csrfToken,
      }),
      redirect: 'manual',
    })

    assert.equal(response.status, 400)
    let html = await response.text()
    assert.ok(html.includes('Ungültige Eingabe'), 'should show validation error for empty email')
    assert.ok(html.includes('<span id="email-error"'), 'should show email field error')
  })

  // -----------------------------------------------------------------------
  // POST /register — rate limiting
  // -----------------------------------------------------------------------
  it('POST /register with repeated attempts for same email returns 429 after limit', async () => {
    let { cookie, csrfToken } = await createCsrfSession(`${BASE}${routes.auth.register.index.href()}`)
    let email = `${TEST_PREFIX}ratelimit@example.com`

    // Fire 6 attempts — the first succeeds (new user, resets counter), then
    // the next 5 hit the duplicate check, incrementing the rate limiter.
    // The 6th attempt already gets blocked (429).
    // We use a fresh CSRF session for each attempt since tokens are single-use.
    for (let i = 0; i < 6; i++) {
      let session = await createCsrfSession(`${BASE}${routes.auth.register.index.href()}`)
      await router.fetch(`${BASE}${routes.auth.register.index.href()}`, {
        method: 'POST',
        headers: { Cookie: session.cookie },
        body: new URLSearchParams({
          name: 'Rate Limit User',
          email,
        password: 'password123!',
        confirmPassword: 'password123!',
        _csrf: session.csrfToken,
        }),
        redirect: 'manual',
      })
    }

    // 6th attempt should be blocked by rate limiter
    let finalSession = await createCsrfSession(`${BASE}${routes.auth.register.index.href()}`)
    let response = await router.fetch(`${BASE}${routes.auth.register.index.href()}`, {
      method: 'POST',
      headers: { Cookie: finalSession.cookie },
      body: new URLSearchParams({
        name: 'Rate Limit User',
        email,
        password: 'password123!',
        confirmPassword: 'password123!',
        _csrf: finalSession.csrfToken,
      }),
      redirect: 'manual',
    })

    assert.equal(response.status, 429, 'should return 429 when rate limited')
    let html = await response.text()
    assert.ok(
      html.toLowerCase().includes('zu viele'),
      'should show rate limit error message',
    )
  })

  // Note: hashPassword('') produces a non-empty hash string, so an empty
  // password passes schema validation (password_hash is not empty).
  // The empty-password edge case is already tested in password-hash.test.ts.
  // This test is intentionally omitted for the controller layer.

  // -----------------------------------------------------------------------
  // POST /register — short password shows field error
  // -----------------------------------------------------------------------
  it('POST /register with short password returns 400 with field error', async () => {
    let { cookie, csrfToken } = await createCsrfSession(`${BASE}${routes.auth.register.index.href()}`)

    let response = await router.fetch(`${BASE}${routes.auth.register.index.href()}`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: new URLSearchParams({
        name: 'Test User',
        email: 'valid@example.com',
        password: 'short',
        confirmPassword: 'short',
        _csrf: csrfToken,
      }),
      redirect: 'manual',
    })

    assert.equal(response.status, 400)
    let html = await response.text()
    assert.ok(html.includes('<span id="password-error"'), 'should show password field error')
    assert.ok(html.includes('<span id="confirm-password-error"'), 'should show confirm-password field error')
  })

  // -----------------------------------------------------------------------
  // POST /register — mismatched passwords shows field error
  // -----------------------------------------------------------------------
  it('POST /register with mismatched passwords returns 400 with field error', async () => {
    let { cookie, csrfToken } = await createCsrfSession(`${BASE}${routes.auth.register.index.href()}`)

    let response = await router.fetch(`${BASE}${routes.auth.register.index.href()}`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: new URLSearchParams({
        name: 'Test User',
        email: 'valid@example.com',
        password: 'securePassword123!',
        confirmPassword: 'differentPassword456!',
        _csrf: csrfToken,
      }),
      redirect: 'manual',
    })

    assert.equal(response.status, 400)
    let html = await response.text()
    assert.ok(html.includes('<span id="confirm-password-error"'), 'should show confirm-password field error')
    assert.ok(html.includes('stimmen nicht überein'), 'should show mismatch error text')
  })
})
