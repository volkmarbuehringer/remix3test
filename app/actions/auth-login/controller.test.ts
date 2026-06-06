import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../../router.ts'
import { createCsrfSession } from '../../test-utils.ts'
import { routes } from '../../routes.ts'

const BASE = 'https://remix.run'

// ---------------------------------------------------------------------------
// Auth Login Controller integration tests
// Requires a running PostgreSQL database seeded with demo users.
// See newapp/app/data/setup.ts for seed data.
// ---------------------------------------------------------------------------

describe('Auth Login controller', () => {
  // -----------------------------------------------------------------------
  // GET /login — page rendering
  // -----------------------------------------------------------------------

  it('GET /auth/login returns the login page', async () => {
    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`)

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('Login'), 'page should contain "Login" heading')
  })

  it('GET /auth/login contains email and password input fields', async () => {
    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`)

    assert.equal(response.status, 200)
    let html = await response.text()

    // Email input
    assert.ok(html.includes('type="email"'), 'page should have an email input')
    assert.ok(html.includes('name="email"'), 'email input should have name="email"')

    // Password input
    assert.ok(html.includes('type="password"'), 'page should have a password input')
    assert.ok(html.includes('name="password"'), 'password input should have name="password"')
  })

  it('GET /auth/login contains the login form with submit button', async () => {
    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`)

    assert.equal(response.status, 200)
    let html = await response.text()

    // Form with POST method
    assert.ok(html.includes('<form'), 'page should contain a form')
    assert.ok(html.includes('method="POST"'), 'form should use POST method')

    // Submit button
    assert.ok(html.includes('type="submit"'), 'page should have a submit button')

    // CSRF token hidden input
    assert.ok(html.includes('name="_csrf"'), 'form should include CSRF token input')
  })

  // -----------------------------------------------------------------------
  // POST /login — successful login
  // -----------------------------------------------------------------------

  it('POST /login with valid admin credentials redirects to /', async () => {
    let { cookie, csrfToken } = await createCsrfSession(`${BASE}${routes.auth.login.index.href()}`)

    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: new URLSearchParams({ email: 'admin@newapp.com', password: 'admin123', _csrf: csrfToken }),
      redirect: 'manual',
    })

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/')
  })

  it('POST /login with valid user credentials redirects to /', async () => {
    let { cookie, csrfToken } = await createCsrfSession(`${BASE}${routes.auth.login.index.href()}`)

    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: new URLSearchParams({ email: 'user@newapp.com', password: 'password123', _csrf: csrfToken }),
      redirect: 'manual',
    })

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/')
  })

  // -----------------------------------------------------------------------
  // POST /login — invalid credentials
  // -----------------------------------------------------------------------

  it('POST /login with wrong password returns 401 with error message', async () => {
    let { cookie, csrfToken } = await createCsrfSession(`${BASE}${routes.auth.login.index.href()}`)

    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: new URLSearchParams({ email: 'admin@newapp.com', password: 'wrongpassword', _csrf: csrfToken }),
      redirect: 'manual',
    })

    assert.equal(response.status, 401)
    let html = await response.text()
    assert.ok(
      html.includes('Invalid email or password'),
      'should show error message for wrong password',
    )
  })

  it('POST /login with non-existent email returns 401 with error message', async () => {
    let { cookie, csrfToken } = await createCsrfSession(`${BASE}${routes.auth.login.index.href()}`)

    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: new URLSearchParams({ email: 'nonexistent@test.com', password: 'somepassword', _csrf: csrfToken }),
      redirect: 'manual',
    })

    assert.equal(response.status, 401)
    let html = await response.text()
    assert.ok(
      html.includes('Invalid email or password'),
      'should show error message for non-existent email',
    )
  })

  // -----------------------------------------------------------------------
  // POST /login — empty/validation edge cases
  // -----------------------------------------------------------------------

  it('POST /login with empty email and password returns 400 for invalid format', async () => {
    let { cookie, csrfToken } = await createCsrfSession(`${BASE}${routes.auth.login.index.href()}`)

    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: new URLSearchParams({ email: '', password: '', _csrf: csrfToken }),
      redirect: 'manual',
    })

    assert.equal(response.status, 400)
    let html = await response.text()
    assert.ok(
      html.includes('Invalid email or password format'),
      'should show format error for empty credentials',
    )
  })

  it('POST /login with missing email field returns 400 for invalid format', async () => {
    let { cookie, csrfToken } = await createCsrfSession(`${BASE}${routes.auth.login.index.href()}`)

    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: new URLSearchParams({ password: 'admin123', _csrf: csrfToken }),
      redirect: 'manual',
    })

    assert.equal(response.status, 400)
    let html = await response.text()
    assert.ok(
      html.includes('Invalid email or password format'),
      'should show format error when email is missing',
    )
  })

  it('POST /login with email but no password returns 401', async () => {
    let { cookie, csrfToken } = await createCsrfSession(`${BASE}${routes.auth.login.index.href()}`)

    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: new URLSearchParams({ email: 'admin@newapp.com', _csrf: csrfToken }),
      redirect: 'manual',
    })

    assert.equal(response.status, 401)
    let html = await response.text()
    assert.ok(
      html.includes('Invalid email or password'),
      'should show auth error when password is missing',
    )
  })
})
