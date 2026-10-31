import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../test-router.ts'
import { routes } from '../routes.ts'
import { createAuthCookieWithCsrfForUser } from '../../test/utils.ts'
import { initializeAppDatabase } from '../db.ts'

// ---------------------------------------------------------------------------
// CSP without 'unsafe-eval' / 'wasm-unsafe-eval'.
//
// The Firefox multiple-import-maps polyfill used to need both tokens: its
// es-module-lexer path compiled Wasm and fell back to eval. Since remix #12059
// (build 57ecca4cba) the polyfill imports `es-module-lexer/minimal/js`, a pure
// asm.js build with no eval/WebAssembly. This guard loads a client-entry page
// (the admin messages grid) and fails on any securitypolicyviolation, so a
// future dependency reintroducing eval is visible in both browsers — Firefox
// is the one that exercises the polyfill.
// ---------------------------------------------------------------------------

type CspViolation = {
  directive: string
  blockedURI: string
  sample: string
}

describe('CSP without eval', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  it('hydrates a client-entry page without CSP violations', async (t) => {
    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')

    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page
      .context()
      .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])

    await page.addInitScript(() => {
      let target = window as unknown as { __cspViolations: CspViolation[] }
      target.__cspViolations = []
      document.addEventListener('securitypolicyviolation', (event) => {
        target.__cspViolations.push({
          directive: event.effectiveDirective,
          blockedURI: event.blockedURI,
          sample: event.sample,
        })
      })
    })

    // The notification bell is a client entry; its unread-count fetch is the
    // hydration signal used by the other admin e2e tests.
    let hydrated = page.waitForResponse(
      (response) => response.url().includes('/notifications/unread-count'),
      { timeout: 15_000 },
    )
    await page.goto(routes.admin.messages.index.href())
    await page.locator('[data-messages-table]').waitFor({ timeout: 15_000 })
    await hydrated
    // Let deferred client entries load through the polyfill (Firefox).
    await page.waitForTimeout(1_000)

    let violations = await page.evaluate(() => {
      let target = window as unknown as { __cspViolations: CspViolation[] }
      return target.__cspViolations
    })

    assert.equal(
      violations.length,
      0,
      `expected no CSP violations, got ${JSON.stringify(violations)}`,
    )
  })
})
