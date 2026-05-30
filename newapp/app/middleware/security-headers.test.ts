import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../router.ts'

const BASE = 'https://remix.run'

describe('Security headers middleware', () => {
  it('sets X-Content-Type-Options header', async () => {
    let response = await router.fetch(`${BASE}/login`)
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff')
  })

  it('sets X-Frame-Options header', async () => {
    let response = await router.fetch(`${BASE}/login`)
    assert.equal(response.headers.get('X-Frame-Options'), 'DENY')
  })

  it('sets Referrer-Policy header', async () => {
    let response = await router.fetch(`${BASE}/login`)
    assert.equal(response.headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin')
  })

  it('sets Content-Security-Policy header', async () => {
    let response = await router.fetch(`${BASE}/login`)
    let csp = response.headers.get('Content-Security-Policy')
    assert.ok(csp, 'CSP header should be present')
  })

  it('CSP includes script-src self', async () => {
    let response = await router.fetch(`${BASE}/login`)
    let csp = response.headers.get('Content-Security-Policy')!
    assert.ok(csp.includes("script-src 'self'"), 'CSP should restrict scripts to self')
  })

  it('CSP includes style-src with unsafe-inline', async () => {
    let response = await router.fetch(`${BASE}/login`)
    let csp = response.headers.get('Content-Security-Policy')!
    assert.ok(csp.includes("style-src 'self' 'unsafe-inline'"), 'CSP should allow inline styles')
  })

  it('CSP connect-src includes opencode.ai', async () => {
    let response = await router.fetch(`${BASE}/login`)
    let csp = response.headers.get('Content-Security-Policy')!
    assert.ok(csp.includes('https://opencode.ai'), 'CSP connect-src should include AI provider')
  })

  it('CSP includes frame-ancestors none', async () => {
    let response = await router.fetch(`${BASE}/login`)
    let csp = response.headers.get('Content-Security-Policy')!
    assert.ok(csp.includes("frame-ancestors 'none'"), 'CSP should block framing')
  })

  it('CSP includes form-action self', async () => {
    let response = await router.fetch(`${BASE}/login`)
    let csp = response.headers.get('Content-Security-Policy')!
    assert.ok(csp.includes("form-action 'self'"), 'CSP should restrict form actions')
  })

  it('sets Permissions-Policy header', async () => {
    let response = await router.fetch(`${BASE}/login`)
    assert.ok(response.headers.get('Permissions-Policy'), 'Permissions-Policy header should be present')
  })

  it('does not set HSTS in development', async () => {
    let response = await router.fetch(`${BASE}/login`)
    // HSTS should only be present in production
    assert.equal(response.headers.get('Strict-Transport-Security'), null)
  })

  it('does not overwrite existing headers', async () => {
    let response = await router.fetch(`${BASE}/login`)
    let csp1 = response.headers.get('Content-Security-Policy')

    let response2 = await router.fetch(`${BASE}/login`)
    let csp2 = response2.headers.get('Content-Security-Policy')

    assert.equal(csp1, csp2, 'CSP should be consistent across requests')
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
