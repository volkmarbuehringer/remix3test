import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../test-router.ts'
import { frames, routes } from '../routes.ts'
import { createAuthCookieWithCsrfForUser } from '../../test/utils.ts'
import { initializeAppDatabase } from '../db.ts'

const BASE = 'https://remix.run'

describe('Security headers middleware', () => {
  before(async () => {
    await initializeAppDatabase()
  })
  it('sets X-Content-Type-Options header', async () => {
    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`)
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff')
  })

  it('sets X-Frame-Options header', async () => {
    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`)
    assert.equal(response.headers.get('X-Frame-Options'), 'DENY')
  })

  it('sets Referrer-Policy header', async () => {
    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`)
    assert.equal(response.headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin')
  })

  it('sets Content-Security-Policy header', async () => {
    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`)
    let csp = response.headers.get('Content-Security-Policy')
    assert.ok(csp, 'CSP header should be present')
  })

  it('CSP includes script-src self', async () => {
    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`)
    let csp = response.headers.get('Content-Security-Policy')!
    assert.ok(csp.includes("script-src 'self'"), 'CSP should restrict scripts to self')
  })

  it('CSP splits style-src so nonce-gated style elements keep inline style attributes', async () => {
    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`)
    let csp = response.headers.get('Content-Security-Policy')!
    let directives = new Map(
      csp.split(';').map((part) => {
        let [name, ...values] = part.trim().split(/\s+/)
        return [name, values] as const
      }),
    )

    assert.deepEqual(
      directives.get('style-src'),
      ["'self'", "'unsafe-inline'"],
      'style-src should stay the unsafe-inline fallback for older browsers',
    )

    let styleSrcElem = directives.get('style-src-elem')
    assert.ok(styleSrcElem, 'style-src-elem should be present')
    assert.ok(styleSrcElem.includes("'self'"), 'style-src-elem should keep self')
    assert.ok(
      styleSrcElem.some((value) => value.startsWith("'nonce-")),
      'style-src-elem should require the request nonce',
    )
    assert.ok(
      !styleSrcElem.includes("'unsafe-inline'"),
      'style-src-elem must not allow unsafe-inline',
    )

    assert.deepEqual(
      directives.get('style-src-attr'),
      ["'unsafe-inline'"],
      'style-src-attr should keep inline style attributes working',
    )
  })

  it('CSP connect-src omits the server-only AI provider origin', async () => {
    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`)
    let csp = response.headers.get('Content-Security-Policy')!
    let connectSrc = csp.split(';').find((part) => part.trim().startsWith('connect-src'))!
    assert.ok(connectSrc.includes("'self'"), 'connect-src should keep self')
    assert.ok(
      !csp.includes('https://opencode.ai'),
      'the AI provider is server-side only and must not be a browser connect source',
    )
  })

  it('CSP connect-src omits the HMR websocket outside the node-HMR child', async () => {
    let previous = process.env.REMIX_NODE_HMR
    delete process.env.REMIX_NODE_HMR
    try {
      let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`)
      let csp = response.headers.get('Content-Security-Policy')!
      let connectSrc = csp.split(';').find((part) => part.trim().startsWith('connect-src'))!
      assert.ok(connectSrc.includes("'self'"), 'connect-src should keep self')
      assert.ok(
        !connectSrc.includes('ws://localhost:44100'),
        'plain dev/test must not allow the HMR websocket',
      )
    } finally {
      if (previous === undefined) delete process.env.REMIX_NODE_HMR
      else process.env.REMIX_NODE_HMR = previous
    }
  })

  it('CSP connect-src includes the HMR websocket inside the node-HMR child', async () => {
    let previous = process.env.REMIX_NODE_HMR
    process.env.REMIX_NODE_HMR = '1'
    try {
      let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`)
      let csp = response.headers.get('Content-Security-Policy')!
      let connectSrc = csp.split(';').find((part) => part.trim().startsWith('connect-src'))!
      assert.ok(
        connectSrc.includes('ws://localhost:44100'),
        'the node-HMR child should allow its development websocket',
      )
    } finally {
      if (previous === undefined) delete process.env.REMIX_NODE_HMR
      else process.env.REMIX_NODE_HMR = previous
    }
  })

  it('CSP includes frame-ancestors none', async () => {
    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`)
    let csp = response.headers.get('Content-Security-Policy')!
    assert.ok(csp.includes("frame-ancestors 'none'"), 'CSP should block framing')
  })

  it('CSP includes form-action self', async () => {
    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`)
    let csp = response.headers.get('Content-Security-Policy')!
    assert.ok(csp.includes("form-action 'self'"), 'CSP should restrict form actions')
  })

  it('sets Permissions-Policy header', async () => {
    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`)
    assert.ok(
      response.headers.get('Permissions-Policy'),
      'Permissions-Policy header should be present',
    )
  })

  it('does not set HSTS in development', async () => {
    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`)
    // HSTS should only be present in production
    assert.equal(response.headers.get('Strict-Transport-Security'), null)
  })

  it('keeps nonce-bearing HTML out of caches', async () => {
    for (let path of [routes.home.href(), routes.auth.login.index.href()]) {
      let response = await router.fetch(`${BASE}${path}`)
      assert.equal(
        response.headers.get('Cache-Control'),
        'private, no-store',
        `${path}: a nonce-bearing document must not be reused by a shared cache`,
      )
    }
  })

  it('keeps frame fragments out of caches', async () => {
    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')

    let response = await router.fetch(`${BASE}${routes.admin.messages.index.href()}`, {
      headers: {
        Cookie: auth!.cookie,
        'X-Remix-Frame': 'true',
        'X-Remix-Target': frames.adminContent,
        Accept: 'text/html',
      },
    })

    assert.equal(response.status, 200)
    assert.match(response.headers.get('Content-Type') ?? '', /^text\/html/)
    assert.equal(
      response.headers.get('Cache-Control'),
      'private, no-store',
      'a frame fragment carries the document nonce and must not be cached',
    )
  })

  it('does not override a cache policy the route already set', async () => {
    let response = await router.fetch(`${BASE}${routes.health.href()}`)
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
  })

  it('CSP includes a per-request nonce for scripts', async () => {
    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`)
    let csp = response.headers.get('Content-Security-Policy')!
    assert.ok(csp.includes("'nonce-"), 'CSP should include a nonce for scripts')
    let scriptSrc = csp.split(';').find((p) => p.trim().startsWith('script-src'))
    assert.ok(
      scriptSrc && !scriptSrc.includes("'unsafe-inline'"),
      'script-src should not allow unsafe-inline',
    )
  })

  it('CSP script-src allows no eval and keeps the polyfill blob path', async () => {
    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`)
    let csp = response.headers.get('Content-Security-Policy')!
    let scriptSrc = csp.split(';').find((p) => p.trim().startsWith('script-src'))!
    assert.ok(!scriptSrc.includes("'unsafe-eval'"), 'script-src should not allow unsafe-eval')
    assert.ok(
      !scriptSrc.includes("'wasm-unsafe-eval'"),
      'script-src should not allow wasm-unsafe-eval',
    )
    assert.ok(scriptSrc.includes('blob:'), 'script-src must keep blob: for polyfilled modules')
  })

  it('uses the CSP header nonce on every rendered nonce attribute', async () => {
    for (let path of [routes.auth.login.index.href(), routes.home.href()]) {
      let response = await router.fetch(`${BASE}${path}`)
      let csp = response.headers.get('Content-Security-Policy')!
      let headerNonce = /'nonce-([^']+)'/.exec(csp)?.[1]
      assert.ok(headerNonce, 'CSP should include a script nonce')

      let html = await response.text()
      let documentNonces = [...html.matchAll(/\snonce="([^"]+)"/g)].map((match) => match[1]!)
      assert.ok(documentNonces.length >= 2, 'document should render authored and generated nonces')
      assert.deepEqual(
        [...new Set(documentNonces)],
        [headerNonce],
        'every document nonce should come from the CSP middleware',
      )

      let importMap = html.match(
        /<script data-rmx-import-map type="importmap"[^>]*\snonce="([^"]+)"/,
      )
      assert.equal(importMap?.[1], headerNonce, 'the generated import map should inherit the nonce')

      let styleTags = [...html.matchAll(/<style\b([^>]*)>/g)]
      assert.ok(
        styleTags.length >= 3,
        'document should render authored theme and shell style elements',
      )
      for (let [, attributes] of styleTags) {
        let nonce = /\snonce="([^"]+)"/.exec(attributes!)?.[1]
        assert.equal(nonce, headerNonce, 'every <style> element must carry the header nonce')
      }
    }
  })

  it('keeps the CSP on static responses', async () => {
    let response = await router.fetch(`${BASE}/fonts/fonts.css`)
    assert.equal(response.status, 200)
    assert.ok(response.headers.get('Content-Security-Policy'), 'static CSS should keep the CSP')
  })

  it('hardens an unmatched router 404 through the middleware chain', async () => {
    // Unmatched routes still run the global middleware, so the 404 gets the
    // same CSP and hardening as a rendered page. It must not be cached.
    let response = await router.fetch(`${BASE}/definitely-not-a-route`)

    assert.equal(response.status, 404)
    assert.ok(response.headers.get('Content-Security-Policy'), '404 should keep the CSP')
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff')
    assert.equal(response.headers.get('X-Frame-Options'), 'DENY')
    assert.equal(response.headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin')
    assert.ok(response.headers.get('Permissions-Policy'), '404 should keep Permissions-Policy')
    assert.equal(response.headers.get('Cache-Control'), 'no-store', '404 must not be cached')
  })

  it('all 6 headers present on a non-auth route too', async () => {
    let response = await router.fetch(`${BASE}/`)
    let headers = [
      'X-Content-Type-Options',
      'X-Frame-Options',
      'Referrer-Policy',
      'Content-Security-Policy',
      'Permissions-Policy',
    ]
    for (let name of headers) {
      assert.ok(response.headers.get(name), `${name} should be present on home page`)
    }
  })
})
