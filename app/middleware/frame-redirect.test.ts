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
// Only targets whose route branches on the target header follow, and only when
// the destination stays inside the request's top-level URL section.
// ---------------------------------------------------------------------------

const BASE = 'https://remix.run/admin/nutzer'

function createContext(
  headers: Record<string, string>,
  routerFetch: (request: Request) => Response | Promise<Response>,
  url: string = BASE,
): RequestContext {
  return {
    url: new URL(url),
    request: new Request(url, { method: 'POST', headers }),
    router: { fetch: routerFetch },
  } as unknown as RequestContext
}

function fragment(text = '<div>grid</div>', status = 200): Response {
  return new Response(text, { status, headers: { 'Content-Type': 'text/html' } })
}

function redirectTo(location: string): Response {
  return new Response(null, { status: 302, headers: { Location: location } })
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
      async () => redirectTo('/admin/nutzer?editing=5'),
    )

    assert.equal(response, fragmentResponse, 'should return the destination fragment')
    assert.ok(received, 'should re-fetch the redirect destination')
    assert.equal(received!.url, destination.href, 'should fetch the redirect destination URL')
    assert.equal(received!.method, 'GET', 'should follow as GET')
    assert.equal(received!.headers.get('X-Remix-Frame'), 'true')
    assert.equal(received!.headers.get('X-Remix-Target'), 'admin-content')
    assert.equal(received!.headers.get('X-Remix-Redirect-Depth'), '1')
    assert.equal(
      response.headers.get('X-Remix-Redirect-To'),
      destination.href,
      'should tell the client where the frame landed',
    )
  })

  it('follows a settings-panel redirect in-frame', async () => {
    let destination = new URL('/settings?tab=display', 'https://remix.run/settings')
    let received: Request | undefined
    let response = await frameRedirects()(
      createContext(
        { 'X-Remix-Frame': 'true', 'X-Remix-Target': 'settings-panel' },
        (request) => {
          received = request
          return fragment('<div>display tab</div>')
        },
        'https://remix.run/settings',
      ),
      async () => redirectTo('/settings?tab=display'),
    )

    assert.ok(received, 'should re-fetch the settings destination')
    assert.equal(received!.url, destination.href)
    assert.equal(received!.headers.get('X-Remix-Target'), 'settings-panel')
    assert.equal(response.headers.get('X-Remix-Redirect-To'), destination.href)
  })

  it('follows an appointments-new redirect in-frame', async () => {
    let base = 'https://remix.run/appointments/new'
    let destination = new URL('/appointments/new?offset=0&sort=a.date', base)
    let received: Request | undefined
    let response = await frameRedirects()(
      createContext(
        { 'X-Remix-Frame': 'true', 'X-Remix-Target': 'appointments-new-content' },
        (request) => {
          received = request
          return fragment('<div>wizard list</div>')
        },
        base,
      ),
      async () => redirectTo('/appointments/new?offset=0&sort=a.date'),
    )

    assert.ok(received, 'should re-fetch the appointments-new destination')
    assert.equal(received!.url, destination.href)
    assert.equal(response.headers.get('X-Remix-Redirect-To'), destination.href)
  })

  it('leaves a cross-section redirect for the client bail', async () => {
    // Settings' delete-account redirects to /auth/login while still on the
    // settings route. Following it would inject the login document into the
    // settings frame; the client's redirect bail must perform a real navigation.
    let redirect = redirectTo('/auth/login')
    let fetchCalls = 0

    let response = await frameRedirects()(
      createContext(
        { 'X-Remix-Frame': 'true', 'X-Remix-Target': 'settings-panel' },
        () => {
          fetchCalls++
          return fragment()
        },
        'https://remix.run/settings',
      ),
      async () => redirect,
    )

    assert.equal(response, redirect, 'should return the cross-section redirect unchanged')
    assert.equal(fetchCalls, 0, 'should not re-fetch a destination outside the section')
  })

  it('leaves a non-frame request redirect unchanged', async () => {
    let redirect = redirectTo('/elsewhere')
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

  it('leaves an unlisted frame target redirect unchanged', async () => {
    // The appointment grid uses JSON mutations, not PRG; its target must stay
    // out of the in-frame follow set unless it grows a fragment destination.
    let redirect = redirectTo('/elsewhere')
    let fetchCalls = 0

    let middleware = frameRedirects()
    let response = await middleware(
      createContext(
        { 'X-Remix-Frame': 'true', 'X-Remix-Target': 'appointment-content' },
        () => {
          fetchCalls++
          return fragment()
        },
        'https://remix.run/appointment',
      ),
      async () => redirect,
    )

    assert.equal(response, redirect, 'should return the unlisted redirect unchanged')
    assert.equal(fetchCalls, 0, 'should not re-fetch an unlisted frame')
  })

  it('does not follow a redirect to an external origin', async () => {
    let redirect = redirectTo('https://evil.example')
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
    let redirect = redirectTo('/loop')
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
