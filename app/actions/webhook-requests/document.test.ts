import * as assert from 'remix/assert'
import { describe, it, before } from 'remix/test'

import { router } from '../../test-router.ts'
import { initializeAppDatabase } from '../../db.ts'
import { createAuthCookieWithCsrf } from '../../test-utils.ts'
import { system } from '../../routes.ts'

/**
 * Asserts the response is a single top-level HTML document: exactly one `<html>`
 * root element, appearing as the first element after the doctype (not nested
 * inside the body).
 */
function assertSingleTopLevelHtml(html: string): void {
  let htmlOpenTags = html.match(/<html[\s>]/g) ?? []
  assert.equal(htmlOpenTags.length, 1, 'should emit exactly one <html> root')

  let rootIndex = html.indexOf('<html')
  assert.ok(
    rootIndex !== -1 && /^\s*<!doctype\s+html[^>]*>\s*$/i.test(html.slice(0, rootIndex)),
    'the single <html> root should be the first element after the doctype',
  )

  assert.ok(html.includes('</html>'), 'should close the html root')
}

describe('Webhook requests document structure', () => {
  let authCookie: string | null

  before(async () => {
    await initializeAppDatabase()
    let result = await createAuthCookieWithCsrf()
    authCookie = result?.cookie ?? null
    assert.ok(authCookie, 'login should set an admin session cookie for tests')
  })

  function authHeaders(): Record<string, string> {
    return authCookie ? { Cookie: authCookie } : {}
  }

  it('GET /webhook-requests renders a single html root with the page title', async () => {
    let response = await router.fetch('https://remix.run' + system.webhookRequests.href(), {
      headers: authHeaders(),
    })

    assert.equal(response.status, 200)
    let html = await response.text()
    assertSingleTopLevelHtml(html)
    assert.ok(html.includes('<title>Webhook Requests</title>'), 'should keep the page title')
  })

  it('GET /webhook-requests/create renders a single html root with the page title', async () => {
    let response = await router.fetch(
      'https://remix.run' + system.webhookRequestCreate.index.href(),
      {
        headers: authHeaders(),
      },
    )

    assert.equal(response.status, 200)
    let html = await response.text()
    assertSingleTopLevelHtml(html)
    assert.ok(html.includes('<title>Webhook erstellen</title>'), 'should keep the page title')
  })
})
