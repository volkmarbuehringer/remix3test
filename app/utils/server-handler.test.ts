import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'
import { router } from '../test-router.ts'
import { system } from '../routes.ts'
import { initializeAppDatabase } from '../db.ts'
import { createServerHandler, renderServerError } from './server-handler.ts'
import { serverErrorContentSecurityPolicy } from '../middleware/security-headers.ts'

/**
 * Regression tests for the two-tier IP trust model: the server boundary
 * (`createServerHandler`) must overwrite any client-supplied `X-Client-Ip`
 * with the TCP socket address it is given, so security decisions — the
 * `/callback` localhost guard, login rate limits — can never be spoofed by
 * request headers. The production entrypoints pass `trustProxy: false`
 * (raw socket address) except under the dev HMR runner.
 */
describe('server handler X-Client-Ip boundary', () => {
  let handleRequest: ReturnType<typeof createServerHandler>

  before(async () => {
    await initializeAppDatabase()
    handleRequest = createServerHandler(router)
  })

  it('a spoofed X-Client-Ip header does not pass the /callback localhost guard', async () => {
    // The client sends X-Client-Ip: 127.0.0.1 but the socket address the
    // listener passes to the boundary is external. Without the boundary
    // overwrite this request would get past the guard (400/404/409); with
    // it, the stamped external IP fails the guard (403) before any parsing.
    let response = await handleRequest(
      new Request(`https://remix.run${system.callback.href()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Ip': '127.0.0.1',
        },
        body: JSON.stringify({ id: crypto.randomUUID() }),
      }),
      '203.0.113.1',
    )
    assert.equal(response.status, 403)
  })

  it('a socket-localhost caller passes the guard and fails at body validation instead', async () => {
    // No spoofed header; the boundary stamps the real (loopback) socket
    // address, the guard opens, and the request proceeds far enough to fail
    // on content type (400) — proving the guard accepted the stamped IP.
    let response = await handleRequest(
      new Request(`https://remix.run${system.callback.href()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'not json',
      }),
      '127.0.0.1',
    )
    assert.equal(response.status, 400)
  })
})

/**
 * The 500 page is returned directly from `onError` in both server entrypoints,
 * so it bypasses `securityHeaders()` / `csp()` entirely. These tests pin the
 * hardening it must apply itself.
 */
describe('renderServerError', () => {
  it('returns a non-cacheable 500 HTML response with the hardening headers', () => {
    let response = renderServerError()

    assert.equal(response.status, 500)
    assert.equal(response.headers.get('Content-Type'), 'text/html; charset=utf-8')
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff')
    assert.equal(response.headers.get('X-Frame-Options'), 'DENY')
    assert.equal(response.headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin')
    assert.ok(
      response.headers.get('Permissions-Policy')?.includes('camera=()'),
      'the error page must carry the same Permissions-Policy as routed responses',
    )
    assert.equal(response.headers.get('Cross-Origin-Opener-Policy'), 'same-origin')
    assert.equal(response.headers.get('Cross-Origin-Resource-Policy'), 'same-origin')
    assert.equal(response.headers.get('Origin-Agent-Cluster'), '?1')
    assert.equal(response.headers.get('X-Permitted-Cross-Domain-Policies'), 'none')
    assert.equal(response.headers.get('X-Dns-Prefetch-Control'), 'off')
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
    assert.equal(
      response.headers.get('Strict-Transport-Security'),
      null,
      'HSTS stays production-only',
    )
  })

  it('applies the static, script-less CSP that allows only the inline style', async () => {
    let response = renderServerError()
    let csp = response.headers.get('Content-Security-Policy')

    assert.equal(csp, serverErrorContentSecurityPolicy)
    assert.ok(csp?.includes("default-src 'none'"), 'the policy must default-deny')
    assert.ok(
      csp?.includes("style-src 'unsafe-inline'"),
      'the inline <style> needs the static style exception',
    )
    assert.ok(csp?.includes("base-uri 'none'"), 'the error page needs no base URL')
    assert.ok(csp?.includes("frame-ancestors 'none'"), 'the error page must not be framed')
    assert.ok(csp?.includes("form-action 'none'"), 'the error page has no forms')

    let body = await response.text()
    assert.ok(body.includes('<style>'), 'the error page keeps its inline style')
    assert.ok(!body.includes('<script'), 'the error page stays script-less')
    assert.ok(!body.includes('nonce='), 'a nonce is meaningless without request context')
  })
})
