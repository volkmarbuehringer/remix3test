import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../test-router.ts'
import { frames, routes } from '../routes.ts'
import { createAuthCookieWithCsrfForUser } from '../../test/utils.ts'
import { initializeAppDatabase } from '../db.ts'
import { pool } from '../../test/pool.ts'
import { permissionsPolicy } from './security-headers.ts'

const BASE = 'https://remix.run'

/** Parses a serialized CSP into directive -> tokens. */
function cspDirectives(csp: string): Map<string, string[]> {
  return new Map(
    csp.split(';').map((part) => {
      let [name, ...values] = part.trim().split(/\s+/)
      return [name!, values] as const
    }),
  )
}

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

  it('gates style elements with the nonce and denies inline style attributes', async () => {
    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`)
    let csp = response.headers.get('Content-Security-Policy')!
    let directives = cspDirectives(csp)

    let styleSrc = directives.get('style-src')
    assert.ok(styleSrc?.includes("'self'"), 'style-src should keep self')
    assert.ok(
      styleSrc?.some((value) => value.startsWith("'nonce-")),
      'style-src should keep the nonce fallback for browsers without the split directives',
    )
    assert.ok(!styleSrc?.includes("'unsafe-inline'"), 'style-src must not allow unsafe-inline')

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
      ["'none'"],
      'inline style attributes are denied; authored styles use css() classes',
    )
  })

  it('renders no inline style attributes', async () => {
    let anonymous = [routes.home.href(), routes.auth.login.index.href()]
    for (let path of anonymous) {
      let response = await router.fetch(`${BASE}${path}`)
      let html = await response.text()
      assert.ok(
        !/\sstyle="/.test(html),
        `${path}: a style attribute would be blocked by style-src-attr 'none'`,
      )
    }

    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')
    for (let path of [
      routes.admin.messages.index.href(),
      routes.admin.uploads.index.href(),
      routes.admin.agentEvents.index.href(),
      routes.appointmentsNew.index.href(),
    ]) {
      let response = await router.fetch(`${BASE}${path}`, {
        headers: { Cookie: auth!.cookie },
      })
      let html = await response.text()
      assert.ok(
        !/\sstyle="/.test(html),
        `${path}: a style attribute would be blocked by style-src-attr 'none'`,
      )
    }
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

  it('reports violations to /csp-reports', async () => {
    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`)
    let csp = response.headers.get('Content-Security-Policy')!

    assert.ok(
      csp.includes('report-uri /csp-reports'),
      'violations should point at the report endpoint',
    )
    assert.ok(
      !csp.includes('report-to'),
      'report-to batches in Chromium; report-uri is the prompt path',
    )
  })

  it('ships a report-only Trusted Types rollout policy', async () => {
    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`)
    let reportOnly = response.headers.get('Content-Security-Policy-Report-Only')

    assert.ok(reportOnly, 'report-only policy should be present')
    assert.ok(
      reportOnly.includes("require-trusted-types-for 'script'"),
      'Trusted Types should be monitored before enforcement',
    )
    assert.ok(
      reportOnly.includes('trusted-types remix/multiple-import-maps-polyfill'),
      'the polyfill policy must be named so it is not reported',
    )
    assert.ok(!reportOnly.includes('script-src'), 'report-only only covers Trusted Types')
  })

  it('CSP includes form-action self', async () => {
    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`)
    let csp = response.headers.get('Content-Security-Policy')!
    assert.ok(csp.includes("form-action 'self'"), 'CSP should restrict form actions')
  })

  it('sets Permissions-Policy header', async () => {
    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`)
    assert.equal(response.headers.get('Permissions-Policy'), permissionsPolicy)
  })

  it('denies every unused powerful feature in Permissions-Policy', async () => {
    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`)
    let value = response.headers.get('Permissions-Policy')!

    // Each feature must be explicitly denied rather than left at the browser
    // default. `publickey-credentials-get` is not used (no WebAuthn).
    for (let feature of [
      'camera',
      'microphone',
      'geolocation',
      'payment',
      'clipboard-read',
      'clipboard-write',
      'fullscreen',
      'picture-in-picture',
      'screen-wake-lock',
      'serial',
      'hid',
      'bluetooth',
      'local-fonts',
      'encrypted-media',
      'publickey-credentials-get',
      'browsing-topics',
    ]) {
      assert.ok(value.includes(`${feature}=()`), `${feature} must be denied`)
    }
  })

  it('denies the unused embedding, worker, and media surface', async () => {
    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`)
    let directives = cspDirectives(response.headers.get('Content-Security-Policy')!)

    // No iframes, plugins, workers, media, or manifest are rendered anywhere in
    // `app/`; only a test fixture uses `<base>`.
    for (let name of ['object-src', 'frame-src', 'worker-src', 'media-src', 'manifest-src']) {
      assert.deepEqual(directives.get(name), ["'none'"], `${name} should be denied`)
    }
    assert.deepEqual(directives.get('base-uri'), ["'none'"], 'base-uri should be denied')
    assert.deepEqual(directives.get('default-src'), ["'self'"], 'default-src stays self')
    assert.deepEqual(
      directives.get('img-src'),
      ["'self'"],
      'the favicon is served from public/, so img-src needs no data: source',
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

  it('CSP script-src allows no eval and no blob scripts', async () => {
    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`)
    let csp = response.headers.get('Content-Security-Policy')!
    let scriptSrc = csp.split(';').find((p) => p.trim().startsWith('script-src'))!
    assert.ok(!scriptSrc.includes("'unsafe-eval'"), 'script-src should not allow unsafe-eval')
    assert.ok(
      !scriptSrc.includes("'wasm-unsafe-eval'"),
      'script-src should not allow wasm-unsafe-eval',
    )
    assert.ok(
      !scriptSrc.includes('blob:'),
      'polyfilled module scripts inherit the nonce, so blob: stays out of script-src',
    )
  })

  it('nonces authored modulepreload links so polyfilled scripts inherit it', async () => {
    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`)
    let csp = response.headers.get('Content-Security-Policy')!
    let headerNonce = /'nonce-([^']+)'/.exec(csp)?.[1]
    assert.ok(headerNonce, 'CSP should include a script nonce')

    let html = await response.text()
    let preloads = [...html.matchAll(/<link\b[^>]*rel="modulepreload"[^>]*>/g)]
    assert.ok(preloads.length > 0, 'the document should render modulepreload links')
    for (let [tag] of preloads) {
      assert.equal(
        /\snonce="([^"]+)"/.exec(tag!)?.[1],
        headerNonce,
        'every authored modulepreload must carry the header nonce',
      )
    }
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

  it('emits one policy for an in-frame PRG follow, not the inner and outer duplicate', async () => {
    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')

    let admin = (await pool.query('SELECT id FROM users WHERE email = $1', ['admin@newapp.com']))
      .rows as { id: number }[]
    assert.ok(admin.length > 0, 'admin user must exist')

    let title = `csp dupe ${crypto.randomUUID()}`
    let inserted = await pool.query(
      'INSERT INTO lists (user_id, title, description, list, created_at, updated_at) VALUES ($1, $2, $3, $4::jsonb, $5, $5) RETURNING id',
      [
        admin[0]!.id,
        title,
        'seeded for the duplicate-policy regression',
        JSON.stringify([{ id: crypto.randomUUID(), label: 'Eintrag' }]),
        Date.now(),
      ],
    )
    let listId = Number(inserted.rows[0]!.id as number)

    try {
      let body = new FormData()
      body.set('_csrf', auth!.csrfToken)
      let response = await router.fetch(`${BASE}/lists/${listId}/copy`, {
        method: 'POST',
        headers: {
          Cookie: auth!.cookie,
          'X-Remix-Frame': 'true',
          'X-Remix-Target': frames.listsContent,
        },
        body,
      })

      assert.equal(response.status, 200, 'the copy redirect should be followed in-frame')
      assert.ok(response.headers.get('X-Remix-Redirect-To'), 'the follow should report its target')

      // frameRedirects re-enters the stack, so the follow's csp() and the
      // enclosing csp() both append the same policy. Mid-layer dedupe keeps a
      // single policy in the final response.
      let csp = response.headers.get('Content-Security-Policy')!
      assert.equal(
        (csp.match(/default-src/g) ?? []).length,
        1,
        'the followed fragment should carry one policy, not a duplicate',
      )
      assert.equal(
        (csp.match(/'nonce-/g) ?? []).length,
        3,
        'script-src, style-src and style-src-elem keep the nonce',
      )
    } finally {
      await pool.query('DELETE FROM lists WHERE id = $1', [listId])
      await pool.query('DELETE FROM lists WHERE title = $1', [`${title} (Kopie)`])
    }
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

  it('sets every hardening header on a non-auth route too', async () => {
    let response = await router.fetch(`${BASE}/`)

    let expected: ReadonlyArray<readonly [string, string]> = [
      ['X-Content-Type-Options', 'nosniff'],
      ['X-Frame-Options', 'DENY'],
      ['Referrer-Policy', 'strict-origin-when-cross-origin'],
      ['Permissions-Policy', permissionsPolicy],
      ['Cross-Origin-Opener-Policy', 'same-origin'],
      ['Cross-Origin-Resource-Policy', 'same-origin'],
      ['Origin-Agent-Cluster', '?1'],
      ['X-Permitted-Cross-Domain-Policies', 'none'],
      ['X-Dns-Prefetch-Control', 'off'],
      ['Cache-Control', 'private, no-store'],
    ]

    for (let [name, value] of expected) {
      assert.equal(response.headers.get(name), value, `${name} should be present on home page`)
    }
    assert.ok(response.headers.get('Content-Security-Policy'), 'CSP should be present on home page')
  })
})
