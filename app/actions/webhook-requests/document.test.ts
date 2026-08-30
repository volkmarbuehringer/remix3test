import * as assert from 'remix/assert'
import { describe, it, before } from 'remix/test'

import { router } from '../../test-router.ts'
import { db, initializeAppDatabase } from '../../db.ts'
import { createAuthCookieWithCsrf } from '../../test-utils.ts'
import { system } from '../../routes.ts'
import { insertWebhookRequest } from '../../data/webhook-requests.ts'

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

  // The frame runtime commits the POST resend action path as its src after an
  // intercepted submission; a reload (SSE invalidate racing the in-flight POST)
  // GETs that path. It must PRG to the grid instead of 404ing — a 404 body
  // diffed into the document crashes the client runtime.
  it('GET /webhook-requests/:id/resend PRGs to the grid preserving grid state', async () => {
    let id = await insertWebhookRequest(db, {
      payload: JSON.stringify({ test: 'resend-resolve' }),
      headers: '{}',
      sourceIp: '127.0.0.1',
      now: Date.now(),
    })

    let response = await router.fetch(
      'https://remix.run' +
        system.webhookRequestResendResolve.href({ id }) +
        '?offset=0&sort=created_at&order=desc&filter=',
      { headers: authHeaders() },
    )

    assert.equal(response.status, 303)
    assert.equal(
      response.headers.get('Location'),
      system.webhookRequests.href() + '?offset=0&sort=created_at&order=desc&filter=',
    )
  })

  it('GET /webhook-requests/:id renders the grid with the edit panel for a known row', async () => {
    let id = await insertWebhookRequest(db, {
      payload: JSON.stringify({ test: 'show-resolve' }),
      headers: '{}',
      sourceIp: '127.0.0.1',
      now: Date.now(),
    })

    let response = await router.fetch(
      'https://remix.run' + system.webhookRequestShow.href({ id }),
      {
        headers: authHeaders(),
      },
    )

    assert.equal(response.status, 200)
    let html = await response.text()
    assertSingleTopLevelHtml(html)
    assert.ok(html.includes('<title>Webhook Requests</title>'), 'should render the grid page')
  })

  it('GET /webhook-requests/:id redirects to the grid for an unknown or invalid id', async () => {
    let missing = await router.fetch(
      'https://remix.run' + system.webhookRequestShow.href({ id: crypto.randomUUID() }),
      { headers: authHeaders() },
    )
    assert.equal(missing.status, 303)
    assert.equal(missing.headers.get('Location'), system.webhookRequests.href())

    let invalid = await router.fetch(
      'https://remix.run' + system.webhookRequestShow.href({ id: 'not-a-uuid' }),
      { headers: authHeaders() },
    )
    assert.equal(invalid.status, 303)
    assert.equal(invalid.headers.get('Location'), system.webhookRequests.href())
  })
})
