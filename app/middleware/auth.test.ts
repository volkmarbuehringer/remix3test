import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'
import type { MiddlewareContext } from 'remix/router'
import { Auth } from 'remix/middleware/auth'
import type { AuthState } from 'remix/middleware/auth'

import type { User } from '../data/schema.ts'
import { requireAuth } from './auth.ts'
import { router } from '../router.ts'
import { createCsrfSession, extractCookie } from '../test-utils.ts'
import { routes } from '../routes.ts'
import { initializeAppDatabase } from '../data/setup.ts'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockAuth(overrides: Partial<AuthState<User>> = {}): AuthState<User> {
  return {
    ok: true,
    identity: { id: 1, role: 'customer', email: 'user@test.com' } as User,
    method: 'session',
    ...overrides,
  } as AuthState<User>
}

function createMockContext(
  auth: AuthState<User> | undefined,
  url = 'https://remix.run/protected',
): MiddlewareContext<any> {
  return {
    get: (key: symbol) => {
      if (key === Auth) return auth
      return undefined
    },
    set: (_key: object, value: unknown) => {
      if (_key === Auth) auth = value as AuthState<User> | undefined
    },
    has: () => true,
    url: new URL(url),
    request: new Request(url),
  } as unknown as MiddlewareContext<any>
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('requireAuth middleware', () => {
  // -----------------------------------------------------------------------
  // Missing auth middleware detection
  // -----------------------------------------------------------------------

  it('throws if auth() middleware has not been registered', async () => {
    let middleware = requireAuth()
    let context = createMockContext(undefined)

    try {
      await middleware(context, async () => new Response('ok'))
      assert.fail('Expected error to be thrown')
    } catch (error) {
      assert.ok(error instanceof Error, 'should throw an Error')
    assert.equal(
        (error as Error).message,
        'Auth state not found. Make sure auth() middleware runs before requireAuth().',
        'should have correct error message',
      )
    }
  })

  // -----------------------------------------------------------------------
  // Unauthenticated user gets 302 redirect
  // -----------------------------------------------------------------------

  it('redirects unauthenticated users to /login with returnTo', async () => {
    let middleware = requireAuth()
    let context = createMockContext(createMockAuth({ ok: false }))

    let response = await middleware(context, async () => new Response('ok'))

    assert.ok(response, 'should return a response')
    assert.equal(response!.status, 302, 'should return 302 redirect')
    let location = response!.headers.get('Location')
    assert.ok(location?.startsWith(routes.auth.login.index.href()), 'should redirect to login')
    assert.ok(location?.includes('returnTo='), 'should include captured return path')
    assert.ok(location?.includes('%2Fprotected'), 'returnTo should be the original URL path')
  })

  it('includes returnTo when original URL has returnTo param', async () => {
    let middleware = requireAuth()
    let context = createMockContext(
      createMockAuth({ ok: false }),
      'https://remix.run/protected?returnTo=%2Fsomething',
    )

    let response = await middleware(context, async () => new Response('ok'))

    assert.ok(response, 'should return a response')
    assert.equal(response!.status, 302)
    assert.equal(
      response!.headers.get('Location'),
      `${routes.auth.login.index.href()}?returnTo=%2Fsomething`,
      'should preserve returnTo parameter',
    )
  })

  it('uses custom redirectTo when configured', async () => {
    let middleware = requireAuth({ redirectTo: '/custom-login' })
    let context = createMockContext(createMockAuth({ ok: false }))

    let response = await middleware(context, async () => new Response('ok'))

    assert.ok(response, 'should return a response')
    assert.equal(response!.status, 302)
    let location = response!.headers.get('Location')
    assert.ok(location?.startsWith('/custom-login'), 'should redirect to custom login page')
    assert.ok(location?.includes('returnTo='), 'should include captured return path')
  })

  // -----------------------------------------------------------------------
  // Authenticated user passes through
  // -----------------------------------------------------------------------

  it('allows authenticated users to pass through', async () => {
    let middleware = requireAuth()
    let userAuth = createMockAuth({
      ok: true,
      identity: { id: 1, role: 'customer' } as User,
    })
    let context = createMockContext(userAuth)
    let nextCalled = false

    let response = await middleware(context, async () => {
      nextCalled = true
      return new Response('protected content')
    })

    assert.ok(nextCalled, 'should call next()')
    assert.ok(response, 'should return a response')
    assert.equal(response!.status, 200, 'should return 200')
    let text = await response!.text()
    assert.equal(text, 'protected content', 'should return handler response')
  })
})

// ---------------------------------------------------------------------------
// Auth + CSRF integration
// ---------------------------------------------------------------------------

const BASE = 'https://remix.run'

describe('Auth + CSRF integration', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  it('session.regenerateId() is called on successful login', async () => {
    // Arrange: get CSRF token and session cookie from login page
    let { cookie, csrfToken } = await createCsrfSession(`${BASE}${routes.auth.login.index.href()}`)

    // Act: login with valid admin credentials
    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: new URLSearchParams({
        email: 'admin@newapp.com',
        password: process.env.SEED_ADMIN_PASSWORD ?? 'admin123',
        _csrf: csrfToken,
      }),
      redirect: 'manual',
    })

    // Assert: successful login (302) with a new session cookie
    assert.equal(response.status, 302)
    let newCookie = extractCookie(response)
    assert.ok(newCookie, 'should return a new session cookie')
    assert.notEqual(
      newCookie,
      cookie,
      'session ID should change after regenerateId()',
    )
  })

  it('CSRF token is stored in session after a GET request', async () => {
    // Arrange & Act: make a GET request that triggers csrf() middleware
    let { cookie, csrfToken } = await createCsrfSession(`${BASE}${routes.auth.login.index.href()}`)

    // Assert: session cookie and CSRF token are created
    assert.ok(cookie.startsWith('session='), 'should have a session cookie')
    assert.equal(csrfToken.length, 64, 'CSRF token should be 64 characters')
    assert.ok(
      /^[0-9a-f]{64}$/.test(csrfToken),
      'CSRF token should be a hex string',
    )
  })

  it('CSRF token from GET can be used for subsequent POST requests', async () => {
    // Arrange: extract token + cookie from login page
    let { cookie, csrfToken } = await createCsrfSession(`${BASE}${routes.auth.login.index.href()}`)

    // Act: use the same token + cookie in a login POST
    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: new URLSearchParams({
        email: 'user@newapp.com',
        password: process.env.SEED_USER_PASSWORD ?? 'password123',
        _csrf: csrfToken,
      }),
      redirect: 'manual',
    })

    // Assert: token was valid, login succeeds
    assert.equal(
      response.status,
      302,
      'POST with valid CSRF token should succeed',
    )
  })
})
