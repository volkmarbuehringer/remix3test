import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { SetCookie } from 'remix/headers'

import { router } from '../../test-router.ts'
import { initializeAppDatabase } from '../../data/setup.ts'
import { createCsrfSession } from '../../test-utils.ts'
import { routes } from '../../routes.ts'

// ---------------------------------------------------------------------------
// Auth End-to-End tests
// Requires a running PostgreSQL database seeded with demo users.
// See newapp/app/data/setup.ts for seed data.
//
// These tests chain multiple requests with session cookies to simulate
// real user journeys, unlike the isolated integration tests in the
// actions/ directory.
// ---------------------------------------------------------------------------

await initializeAppDatabase()

// Use unique email prefix to avoid conflicts between test runs
const TEST_PREFIX = `e2e-${Date.now()}-`

const BASE = 'https://remix.run'

/**
 * Extract the session cookie value from a Response's Set-Cookie header.
 * Returns the raw `session=<sid>` string for use in subsequent requests,
 * or null if no session cookie was set.
 */
function extractSessionCookie(response: Response): string | null {
  let setCookie = SetCookie.from(response.headers.get('Set-Cookie'))
  if (!setCookie.name) return null
  return `${setCookie.name}=${setCookie.value ?? ''}`
}

describe('auth e2e', () => {
  // -----------------------------------------------------------------------
  // Full user journey: register → logout → login with same credentials
  // -----------------------------------------------------------------------

  it('completes the full auth journey: register → logout → login', async () => {
    // Arrange
    let email = `${TEST_PREFIX}journey@example.com`
    let password = 'journeyPass123!'

    // --- Step 1: Register a new user ---
    let { cookie: registerCsrfCookie, csrfToken: registerCsrf } = await createCsrfSession(
      `${BASE}${routes.auth.register.index.href()}`,
    )
    let registerResponse = await router.fetch(`${BASE}${routes.auth.register.index.href()}`, {
      method: 'POST',
      body: new URLSearchParams({
        name: 'Journey Test User',
        email,
        password,
        confirmPassword: password,
        _csrf: registerCsrf,
      }),
      headers: { Cookie: registerCsrfCookie },
      redirect: 'manual',
    })

    // Assert: Register redirects to register-sent page (no auto-login with email verification)
    assert.equal(registerResponse.status, 302, 'register should redirect')
    assert.equal(
      registerResponse.headers.get('Location'),
      routes.auth.registerSent.href(),
      'register should redirect to register-sent page',
    )

    // --- Step 2: Login with the registered credentials ---
    let { cookie: loginCsrfCookie, csrfToken: loginCsrf } = await createCsrfSession(
      `${BASE}${routes.auth.login.index.href()}`,
    )
    let loginResponse = await router.fetch(`${BASE}${routes.auth.login.index.href()}`, {
      method: 'POST',
      body: new URLSearchParams({ email, password, _csrf: loginCsrf }),
      headers: { Cookie: loginCsrfCookie },
      redirect: 'manual',
    })

    // Assert: Login authenticates and redirects to home
    assert.equal(loginResponse.status, 302, 'login should redirect')
    assert.equal(loginResponse.headers.get('Location'), '/', 'login should redirect to home')

    let cookie = extractSessionCookie(loginResponse)
    assert.ok(cookie, 'login should set an authenticated session cookie')

    // --- Step 3: Logout ---
    let { cookie: logoutCsrfCookie, csrfToken: logoutCsrf } = await createCsrfSession(
      `${BASE}${routes.auth.login.index.href()}`,
    )
    let logoutResponse = await router.fetch(`${BASE}${routes.auth.logout.href()}`, {
      method: 'POST',
      body: new URLSearchParams({ _csrf: logoutCsrf }),
      headers: { Cookie: logoutCsrfCookie },
      redirect: 'manual',
    })

    // Assert: Logout unsets auth and redirects to home
    assert.equal(logoutResponse.status, 302, 'logout should redirect')
    assert.equal(logoutResponse.headers.get('Location'), '/', 'logout should redirect to home')
  })

  // -----------------------------------------------------------------------
  // Login with seed admin account → verify redirect → logout
  // -----------------------------------------------------------------------

  it('logs in with seed admin account then logs out', async () => {
    // --- Step 1: Login as admin ---
    let { cookie: loginCsrfCookie, csrfToken: loginCsrf } = await createCsrfSession(
      `${BASE}${routes.auth.login.index.href()}`,
    )
    let loginResponse = await router.fetch(`${BASE}${routes.auth.login.index.href()}`, {
      method: 'POST',
      body: new URLSearchParams({
        email: 'admin@newapp.com',
        password: process.env.SEED_ADMIN_PASSWORD!,
        _csrf: loginCsrf,
      }),
      headers: { Cookie: loginCsrfCookie },
      redirect: 'manual',
    })

    // Assert: Admin login succeeds
    assert.equal(loginResponse.status, 302, 'admin login should redirect')
    assert.equal(loginResponse.headers.get('Location'), '/', 'admin login should redirect to home')

    let adminCookie = extractSessionCookie(loginResponse)
    assert.ok(adminCookie, 'admin login should set a session cookie')

    // --- Step 2: Logout ---
    let { cookie: logoutCsrfCookie, csrfToken: logoutCsrf } = await createCsrfSession(
      `${BASE}${routes.auth.login.index.href()}`,
    )
    let logoutResponse = await router.fetch(`${BASE}${routes.auth.logout.href()}`, {
      method: 'POST',
      body: new URLSearchParams({ _csrf: logoutCsrf }),
      headers: { Cookie: logoutCsrfCookie },
      redirect: 'manual',
    })

    // Assert: Logout succeeds with regenerated session ID
    assert.equal(logoutResponse.status, 302, 'logout should redirect after admin login')
    assert.equal(logoutResponse.headers.get('Location'), '/', 'logout should redirect to home')

    let logoutCookie = extractSessionCookie(logoutResponse)
    assert.ok(logoutCookie, 'logout after admin should set a new session cookie')
  })

  // -----------------------------------------------------------------------
  // Login with seed user account
  // -----------------------------------------------------------------------

  it('logs in with seed user account', async () => {
    let { cookie, csrfToken } = await createCsrfSession(`${BASE}${routes.auth.login.index.href()}`)
    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`, {
      method: 'POST',
      body: new URLSearchParams({
        email: 'user@newapp.com',
        password: process.env.SEED_USER_PASSWORD!,
        _csrf: csrfToken,
      }),
      headers: { Cookie: cookie },
      redirect: 'manual',
    })

    // Assert: User login redirects to home with session cookie
    assert.equal(response.status, 302, 'user login should redirect')
    assert.equal(response.headers.get('Location'), '/', 'user login should redirect to home')

    let sessionCookie = extractSessionCookie(response)
    assert.ok(sessionCookie, 'user login should set a session cookie')
  })

  // -----------------------------------------------------------------------
  // Invalid login attempts
  // -----------------------------------------------------------------------

  it('rejects login with wrong password for seed admin', async () => {
    let { cookie, csrfToken } = await createCsrfSession(`${BASE}${routes.auth.login.index.href()}`)
    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`, {
      method: 'POST',
      body: new URLSearchParams({
        email: 'admin@newapp.com',
        password: 'wrongpassword',
        _csrf: csrfToken,
      }),
      headers: { Cookie: cookie },
      redirect: 'manual',
    })

    // Assert: Returns 401 with error message, no redirect
    assert.equal(response.status, 401, 'wrong password should return 401')
    let html = await response.text()
    assert.ok(
      html.includes('Invalid email or password'),
      'should show error message for wrong password',
    )
  })

  it('rejects login with non-existent email', async () => {
    let { cookie, csrfToken } = await createCsrfSession(`${BASE}${routes.auth.login.index.href()}`)
    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`, {
      method: 'POST',
      body: new URLSearchParams({
        email: 'nonexistent@test.com',
        password: 'somepassword',
        _csrf: csrfToken,
      }),
      headers: { Cookie: cookie },
      redirect: 'manual',
    })

    // Assert: Returns 401 with error message
    assert.equal(response.status, 401, 'non-existent email should return 401')
    let html = await response.text()
    assert.ok(
      html.includes('Invalid email or password'),
      'should show error message for non-existent email',
    )
  })

  // -----------------------------------------------------------------------
  // GET /login — form rendering
  // -----------------------------------------------------------------------

  it('GET /login renders the login form', async () => {
    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`)

    assert.equal(response.status, 200)
    let html = await response.text()

    // Page heading
    assert.ok(html.includes('Sign in to newapp'), 'page should contain "Sign in to newapp" heading')

    // Form structure
    assert.ok(html.includes('<form'), 'page should contain a form element')
    assert.ok(html.includes('method="POST"'), 'form should use POST method')

    // Email field
    assert.ok(html.includes('type="email"'), 'page should have an email input')
    assert.ok(html.includes('name="email"'), 'email input should have name="email"')

    // Password field
    assert.ok(html.includes('type="password"'), 'page should have a password input')
    assert.ok(html.includes('name="password"'), 'password input should have name="password"')

    // Submit button
    assert.ok(html.includes('type="submit"'), 'page should have a submit button')

    // CSRF token
    assert.ok(html.includes('name="_csrf"'), 'login form should include CSRF token')
  })

  // -----------------------------------------------------------------------
  // GET /register — form rendering
  // -----------------------------------------------------------------------

  it('GET /register renders the registration form', async () => {
    let response = await router.fetch(`${BASE}${routes.auth.register.index.href()}`)

    assert.equal(response.status, 200)
    let html = await response.text()

    // Page heading
    assert.ok(
      html.includes('Create your account'),
      'page should contain "Create your account" heading',
    )

    // Form structure
    assert.ok(html.includes('<form'), 'page should contain a form element')
    assert.ok(html.includes('method="POST"'), 'form should use POST method')

    // Name field
    assert.ok(html.includes('name="name"'), 'page should have a name input')

    // Email field
    assert.ok(html.includes('type="email"'), 'page should have an email input')
    assert.ok(html.includes('name="email"'), 'email input should have name="email"')

    // Password field
    assert.ok(html.includes('type="password"'), 'page should have a password input')
    assert.ok(html.includes('name="password"'), 'password input should have name="password"')

    // Submit button
    assert.ok(html.includes('type="submit"'), 'page should have a submit button')

    // CSRF token
    assert.ok(html.includes('name="_csrf"'), 'register form should include CSRF token')
  })
})
