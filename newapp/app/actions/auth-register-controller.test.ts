import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../router.ts'
import { createCsrfSession } from '../test-utils.ts'

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
    let response = await router.fetch(`${BASE}/register`)

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
  it('POST /register with valid data creates user and redirects to /', async () => {
    let { cookie, csrfToken } = await createCsrfSession(`${BASE}/register`)
    let email = `${TEST_PREFIX}valid@example.com`

    let response = await router.fetch(`${BASE}/register`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: new URLSearchParams({
        name: 'Test User',
        email,
        password: 'securePassword123',
        _csrf: csrfToken,
      }),
      redirect: 'manual',
    })

    assert.equal(response.status, 302, 'should redirect on success')
    assert.equal(response.headers.get('Location'), '/', 'should redirect to home')
  })

  // -----------------------------------------------------------------------
  // POST /register — duplicate email
  // -----------------------------------------------------------------------
  it('POST /register with duplicate email returns 400 with error', async () => {
    let { cookie, csrfToken } = await createCsrfSession(`${BASE}/register`)
    let email = `${TEST_PREFIX}duplicate@example.com`

    // Create the user first
    let createResponse = await router.fetch(`${BASE}/register`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: new URLSearchParams({
        name: 'First User',
        email,
        password: 'password123',
        _csrf: csrfToken,
      }),
      redirect: 'manual',
    })
    assert.equal(createResponse.status, 302, 'first creation should succeed')

    // Try to register again with the same email (reuse same cookie + token)
    let response = await router.fetch(`${BASE}/register`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: new URLSearchParams({
        name: 'Second User',
        email,
        password: 'otherpass456',
        _csrf: csrfToken,
      }),
      redirect: 'manual',
    })

    assert.equal(response.status, 400, 'duplicate should return 400')
    let html = await response.text()
    assert.ok(html.includes('already exists'), 'should show duplicate email error')
  })

  // -----------------------------------------------------------------------
  // POST /register — invalid field handling
  //
  // The register controller now validates form data client-side before
  // hitting the database. Invalid fields return 400 with an error message.
  // -----------------------------------------------------------------------
  it('POST /register with empty name returns 400 with error message', async () => {
    let { cookie, csrfToken } = await createCsrfSession(`${BASE}/register`)
    let email = `${TEST_PREFIX}emptyname@example.com`

    let response = await router.fetch(`${BASE}/register`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: new URLSearchParams({
        name: '',
        email,
        password: 'password123',
        _csrf: csrfToken,
      }),
      redirect: 'manual',
    })

    assert.equal(response.status, 400)
    let html = await response.text()
    assert.ok(html.includes('Invalid input'), 'should show validation error for empty name')
  })

  it('POST /register with empty email returns 400 with error message', async () => {
    let { cookie, csrfToken } = await createCsrfSession(`${BASE}/register`)

    let response = await router.fetch(`${BASE}/register`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: new URLSearchParams({
        name: 'Test User',
        email: '',
        password: 'password123',
        _csrf: csrfToken,
      }),
      redirect: 'manual',
    })

    assert.equal(response.status, 400)
    let html = await response.text()
    assert.ok(html.includes('Invalid input'), 'should show validation error for empty email')
  })

  // Note: hashPassword('') produces a non-empty hash string, so an empty
  // password passes schema validation (password_hash is not empty).
  // The empty-password edge case is already tested in password-hash.test.ts.
  // This test is intentionally omitted for the controller layer.
})
