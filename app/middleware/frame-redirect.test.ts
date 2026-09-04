import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import type { RequestContext } from 'remix/router'

import { frameRedirects } from './frame-redirect.ts'

// ---------------------------------------------------------------------------
// frameRedirects — follows redirects in-frame for subframe requests
//
// Subframe requests (X-Remix-Frame: true + a non-null X-Remix-Target) that end
// in a 3xx are re-fetched as a GET with the frame headers so the destination
// can render a fragment for the frame instead of forcing a full page load.
// ---------------------------------------------------------------------------

const BASE = 'https://remix.run/admin/nutzer'

function createContext(
  headers: Record<string, string>,
  routerFetch: (request: Request) => Response | Promise<Response>,
): RequestContext {
  return {
    url: new URL(BASE),
    request: new Request(BASE, { method: 'POST', headers }),
    router: { fetch: routerFetch },
  } as unknown as RequestContext
}

function fragment(text = '<div>grid</div>', status = 200): Response {
  return new Response(text, { status, headers: { 'Content-Type': 'text/html' } })
}

describe('frameRedirects middleware', () => {
  it('follows a subframe redirect in-frame with frame headers', async () => {
    let destination = new URL('/admin/nutzer?editing=5', BASE)
    let fragmentResponse = fragment('<div>grid with editing row</div>')

    let received: Request | undefined
    let middleware = frameRedirects()
    let response = await middleware(
      createContext({ 'X-Remix-Frame': 'true', 'X-Remix-Target': 'admin-content' }, (request) => {
        received = request
        return fragmentResponse
      }),
      async () =>
        new Response(null, { status: 302, headers: { Location: '/admin/nutzer?editing=5' } }),
    )

    assert.equal(response, fragmentResponse, 'should return the destination fragment')
    assert.ok(received, 'should re-fetch the redirect destination')
    assert.equal(received!.url, destination.href, 'should fetch the redirect destination URL')
    assert.equal(received!.method, 'GET', 'should follow as GET')
    assert.equal(received!.headers.get('X-Remix-Frame'), 'true')
    assert.equal(received!.headers.get('X-Remix-Target'), 'admin-content')
    assert.equal(received!.headers.get('X-Remix-Redirect-Depth'), '1')
  })

  it('leaves a non-frame request redirect unchanged', async () => {
    let redirect = new Response(null, { status: 302, headers: { Location: '/elsewhere' } })
    let fetchCalls = 0

    let middleware = frameRedirects()
    let response = await middleware(
      createContext({}, () => {
        fetchCalls++
        return fragment()
      }),
      async () => redirect,
    )

    assert.equal(response, redirect, 'should return the redirect unchanged')
    assert.equal(fetchCalls, 0, 'should not re-fetch for non-frame requests')
  })

  it('leaves a subframe 200 response unchanged', async () => {
    let ok = fragment()
    let fetchCalls = 0

    let middleware = frameRedirects()
    let response = await middleware(
      createContext({ 'X-Remix-Frame': 'true', 'X-Remix-Target': 'admin-content' }, () => {
        fetchCalls++
        return fragment()
      }),
      async () => ok,
    )

    assert.equal(response, ok, 'should return the 200 response unchanged')
    assert.equal(fetchCalls, 0, 'should not re-fetch a non-redirect response')
  })

  it('leaves a non-admin subframe redirect unchanged', async () => {
    // Step 1 scope: only admin shell frames follow in-frame. A verwaltung /
    // appointment target redirect must fall back to the client bail unchanged.
    let redirect = new Response(null, { status: 302, headers: { Location: '/elsewhere' } })
    let fetchCalls = 0

    let middleware = frameRedirects()
    let response = await middleware(
      createContext({ 'X-Remix-Frame': 'true', 'X-Remix-Target': 'appointment-content' }, () => {
        fetchCalls++
        return fragment()
      }),
      async () => redirect,
    )

    assert.equal(response, redirect, 'should return the non-admin redirect unchanged')
    assert.equal(fetchCalls, 0, 'should not re-fetch a non-admin frame')
  })

  it('does not follow a redirect to an external origin', async () => {
    let redirect = new Response(null, {
      status: 302,
      headers: { Location: 'https://evil.example' },
    })
    let fetchCalls = 0

    let middleware = frameRedirects()
    let response = await middleware(
      createContext({ 'X-Remix-Frame': 'true', 'X-Remix-Target': 'admin-content' }, () => {
        fetchCalls++
        return fragment()
      }),
      async () => redirect,
    )

    assert.equal(response, redirect, 'should leave the external redirect for the client bail')
    assert.equal(fetchCalls, 0, 'should not re-fetch external origins')
  })

  it('bails when the redirect depth limit is reached', async () => {
    let redirect = new Response(null, { status: 302, headers: { Location: '/loop' } })
    let fetchCalls = 0

    let middleware = frameRedirects()
    let response = await middleware(
      createContext(
        {
          'X-Remix-Frame': 'true',
          'X-Remix-Target': 'admin-content',
          'X-Remix-Redirect-Depth': '10',
        },
        () => {
          fetchCalls++
          return fragment()
        },
      ),
      async () => redirect,
    )

    assert.equal(response, redirect, 'should return the redirect unchanged at the depth limit')
    assert.equal(fetchCalls, 0, 'should not re-fetch at the depth limit')
  })
})
