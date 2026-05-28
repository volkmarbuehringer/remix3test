import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import type { MiddlewareContext } from 'remix/router'
import { Auth } from 'remix/middleware/auth'
import type { AuthState } from 'remix/middleware/auth'
import { Renderer } from 'remix/middleware/render'
import type { RemixNode } from 'remix/ui'

import type { User } from '../data/schema.ts'
import { requireAdmin } from './admin.ts'

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
  options?: {
    url?: string
    captureForbidden?: (node: RemixNode | null) => void
  },
): MiddlewareContext<any> {
  let capturedNode: RemixNode | null = null

  return {
    get: (key: symbol) => {
      if (key === Auth) return auth
      if (key === Renderer) {
        return (node: RemixNode, init?: ResponseInit) => {
          capturedNode = node
          if (options?.captureForbidden) {
            options.captureForbidden(node)
          }
          // Return a plain text response for test assertions
          let text = typeof node === 'string' ? node : 'ForbiddenPage rendered'
          return new Response(text, { status: init?.status ?? 200 })
        }
      }
      return undefined
    },
    set: (_key: object, value: unknown) => {
      if (_key === Auth) auth = value as AuthState<User> | undefined
    },
    has: () => true,
    url: new URL(options?.url ?? 'https://remix.run/admin/messages'),
    request: new Request(options?.url ?? 'https://remix.run/admin/messages'),
  } as unknown as MiddlewareContext<any>
}

const FORBIDDEN_TEXT = 'ForbiddenPage rendered'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('requireAdmin middleware', () => {
  // -----------------------------------------------------------------------
  // Missing auth middleware detection
  // -----------------------------------------------------------------------

  it('throws if auth() middleware has not been registered', async () => {
    // Arrange
    let middleware = requireAdmin()
    let context = createMockContext(undefined)

    // Act & Assert
    try {
      await middleware(context, async () => new Response('ok'))
      assert.fail('Expected error to be thrown')
    } catch (error) {
      assert.ok(error instanceof Error, 'should throw an Error')
      assert.equal(
        (error as Error).message,
        'Expected auth() middleware before requireAdmin()',
        'should have correct error message',
      )
    }
  })

  // -----------------------------------------------------------------------
  // Unauthenticated user gets 302 redirect
  // -----------------------------------------------------------------------

  it('redirects unauthenticated users to /login', async () => {
    // Arrange
    let middleware = requireAdmin()
    let context = createMockContext(createMockAuth({ ok: false }))

    // Act
    let response = await middleware(context, async () => new Response('ok'))

    // Assert
    assert.ok(response, 'should return a response')
    assert.equal(response!.status, 302, 'should return 302 redirect')
    let location = response!.headers.get('Location')
    assert.equal(location, '/login', 'should redirect to /login')
  })

  it('preserves returnTo param when present in request URL', async () => {
    // Arrange
    let middleware = requireAdmin()
    let context = createMockContext(createMockAuth({ ok: false }), {
      url: 'https://remix.run/admin/messages?returnTo=%2Fadmin%2Fmessages',
    })

    // Act
    let response = await middleware(context, async () => new Response('ok'))

    // Assert
    assert.ok(response, 'should return a response')
    assert.equal(response!.status, 302, 'should return 302 redirect')
    let location = response!.headers.get('Location')
    assert.ok(
      location?.startsWith('/login'),
      'should redirect to /login',
    )
    assert.ok(
      location?.includes('returnTo='),
      'should include captured return path',
    )
    assert.ok(
      location?.includes('%2Fadmin%2Fmessages'),
      'returnTo should be the original URL path',
    )
  })

  it('uses custom redirectTo when configured', async () => {
    // Arrange
    let middleware = requireAdmin({ redirectTo: '/custom-login' })
    let context = createMockContext(createMockAuth({ ok: false }))

    // Act
    let response = await middleware(context, async () => new Response('ok'))

    // Assert
    assert.ok(response, 'should return a response')
    assert.equal(response!.status, 302)
    let location = response!.headers.get('Location')
    assert.equal(
      location,
      '/custom-login',
      'should redirect to custom login page',
    )
  })

  // -----------------------------------------------------------------------
  // Non-admin user gets 403 with ForbiddenPage
  // -----------------------------------------------------------------------

  it('returns 403 for non-admin users with component-rendered ForbiddenPage', async () => {
    // Arrange
    let capturedNode: RemixNode | null = null
    let middleware = requireAdmin()
    let context = createMockContext(createMockAuth({ ok: true, identity: { id: 2, role: 'customer' } as User }), {
      captureForbidden: (node) => {
        capturedNode = node
      },
    })

    // Act
    let response = await middleware(context, async () => new Response('ok'))

    // Assert
    assert.ok(response, 'should return a response')
    assert.equal(response!.status, 403, 'should return 403 Forbidden')
    assert.ok(
      capturedNode != null,
      'should render ForbiddenPage component (not hardcoded HTML)',
    )
  })

  // -----------------------------------------------------------------------
  // Custom forbidden page option
  // -----------------------------------------------------------------------

  it('uses custom forbiddenPage when provided as a RemixNode', async () => {
    // Arrange
    let capturedNode: RemixNode | null = null
    let customPage = 'Custom Forbidden Content'
    let middleware = requireAdmin({
      forbiddenPage: customPage,
    })
    let context = createMockContext(createMockAuth({ ok: true, identity: { id: 2, role: 'customer' } as User }), {
      captureForbidden: (node) => {
        capturedNode = node
      },
    })

    // Act
    let response = await middleware(context, async () => new Response('ok'))

    // Assert
    assert.ok(response, 'should return a response')
    assert.equal(response!.status, 403, 'should return 403 Forbidden')
    assert.equal(
      capturedNode,
      customPage,
      'should render the custom forbidden page',
    )
    let text = await response!.text()
    assert.equal(text, customPage, 'response body should match custom page')
  })

  it('uses custom forbiddenPage when provided as a Response', async () => {
    // Arrange
    let customResponse = new Response('Custom HTML', {
      status: 403,
      headers: { 'Content-Type': 'text/html' },
    })
    let middleware = requireAdmin({
      forbiddenPage: customResponse,
    })
    let context = createMockContext(createMockAuth({ ok: true, identity: { id: 2, role: 'customer' } as User }))

    // Act
    let response = await middleware(context, async () => new Response('ok'))

    // Assert
    assert.ok(response, 'should return a response')
    assert.equal(response!.status, 403, 'should return 403 Forbidden')
    let text = await response!.text()
    assert.equal(text, 'Custom HTML', 'response should match custom Response body')
  })

  // -----------------------------------------------------------------------
  // Admin user passes through
  // -----------------------------------------------------------------------

  it('allows admin users to pass through', async () => {
    // Arrange
    let middleware = requireAdmin()
    let adminAuth = createMockAuth({
      ok: true,
      identity: { id: 1, role: 'admin', email: 'admin@test.com' } as User,
    })
    let context = createMockContext(adminAuth)
    let nextCalled = false

    // Act
    let response = await middleware(context, async () => {
      nextCalled = true
      return new Response('admin content')
    })

    // Assert
    assert.ok(nextCalled, 'should call next()')
    assert.ok(response, 'should return a response')
    assert.equal(response!.status, 200, 'should return 200')
    let text = await response!.text()
    assert.equal(text, 'admin content', 'should return handler response')
  })
})
