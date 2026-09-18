import * as assert from 'remix/assert'
import { describe, it, before, afterEach } from 'remix/test'

import { router } from '../../../test-router.ts'
import { db, initializeAppDatabase } from '../../../db.ts'
import { pool } from '../../../data/test-pool.ts'
import { createAuthCookieWithCsrf, createAuthCookieWithCsrfForUser } from '../../../test-utils.ts'
import { readSessionId, sessionStorage } from '../../../middleware/session.ts'
import { routes } from '../../../routes.ts'
import { getWebhookRequest, insertWebhookRequest } from '../../../data/webhook-requests.ts'

const BASE = 'https://remix.run'
const TEST_SOURCE_IP = 'test-webhook-admin'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Asserts the response is a single top-level HTML document: exactly one <html>
 * root element, starting with the doctype and closing cleanly.
 */
function assertSingleTopLevelHtml(html: string): void {
  let first = html.indexOf('<html')
  assert.ok(first !== -1, 'should emit an <html> root')
  assert.ok(html.indexOf('<html', first + 1) === -1, 'should emit exactly one <html> root')
  assert.ok(html.toLowerCase().includes('<!doctype html'), 'should keep the doctype')
  assert.ok(html.includes('</html>'), 'should close the html root')
}

describe('Admin webhook requests', () => {
  let authCookie: string | null
  let csrfToken: string

  before(async () => {
    await initializeAppDatabase()
    let result = await createAuthCookieWithCsrf()
    authCookie = result?.cookie ?? null
    csrfToken = result?.csrfToken ?? ''
    assert.ok(authCookie, 'login should set an admin session cookie for tests')
  })

  afterEach(async () => {
    await pool.query('DELETE FROM webhook_requests WHERE source_ip = $1', [TEST_SOURCE_IP])
    await pool.query("DELETE FROM audit_logs WHERE target_type = 'webhook_requests'")
  })

  function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
    return authCookie ? { Cookie: authCookie, ...extra } : extra
  }

  /** Headers for a CSRF-protected form POST from the admin session. */
  function formHeaders(): Record<string, string> {
    return authHeaders({
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Csrf-Token': csrfToken,
    })
  }

  async function insertRow(marker: string): Promise<string> {
    return insertWebhookRequest(db, {
      payload: JSON.stringify({ test: marker }),
      headers: '{}',
      sourceIp: TEST_SOURCE_IP,
      now: Date.now(),
    })
  }

  async function readFlash(kind: 'success' | 'error'): Promise<string | undefined> {
    if (!authCookie) return undefined
    let rawSid = await readSessionId(authCookie)
    if (!rawSid) return undefined
    let session = await sessionStorage.read(rawSid)
    return session.get(kind) as string | undefined
  }

  it('GET /admin/webhook-requests renders the grid inside a single html root', async () => {
    let response = await router.fetch(BASE + routes.admin.webhookRequests.index.href(), {
      headers: authHeaders(),
    })
    assert.equal(response.status, 200)
    let html = await response.text()
    assertSingleTopLevelHtml(html)
    assert.ok(html.includes('Filter (Payload)'), 'should render the payload filter')
  })

  it('GET /admin/webhook-requests/create renders the composer', async () => {
    let response = await router.fetch(BASE + routes.admin.webhookRequests.create.index.href(), {
      headers: authHeaders(),
    })
    assert.equal(response.status, 200)
    let html = await response.text()
    assertSingleTopLevelHtml(html)
    assert.ok(html.includes('Webhook erstellen'), 'should render the composer heading')
  })

  it('POST re-renders 200 with an inline error for an invalid payload', async () => {
    let id = await insertRow('invalid-json')
    let body = new URLSearchParams({ _csrf: csrfToken, _method: 'PUT', payload: '{ not json' })
    let response = await router.fetch(BASE + routes.admin.webhookRequests.update.href({ id }), {
      method: 'POST',
      headers: formHeaders(),
      body: body.toString(),
    })
    assert.equal(response.status, 200, 'validation failure should re-render at 200')
    let html = await response.text()
    assert.ok(html.includes('Ungültiges JSON im Payload.'), 'should show the inline error')
  })

  it('POST validation error preserves the submitted grid state', async () => {
    let id = await insertRow('invalid-grid')
    let body = new URLSearchParams({
      _csrf: csrfToken,
      _method: 'PUT',
      payload: '{ not json',
      _offset: '15',
      _sort: 'source_ip',
      _order: 'asc',
      _filter: 'garten',
    })
    let response = await router.fetch(BASE + routes.admin.webhookRequests.update.href({ id }), {
      method: 'POST',
      headers: formHeaders(),
      body: body.toString(),
    })
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('sort=source_ip'), 'should keep the submitted sort column')
    assert.ok(html.includes('order=asc'), 'should keep the submitted sort direction')
  })

  it('POST validation error still shows the banner when the row no longer exists', async () => {
    let id = crypto.randomUUID()
    let body = new URLSearchParams({ _csrf: csrfToken, _method: 'PUT', payload: '{ not json' })
    let response = await router.fetch(BASE + routes.admin.webhookRequests.update.href({ id }), {
      method: 'POST',
      headers: formHeaders(),
      body: body.toString(),
    })
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(
      html.includes('Ungültiges JSON im Payload.'),
      'the error banner must render without an edit row',
    )
  })

  it('POST /admin/webhook-requests/create persists a row and redirects to the edit panel', async () => {
    let body = new URLSearchParams({
      _csrf: csrfToken,
      payload: JSON.stringify({ test: 'created' }),
    })
    let response = await router.fetch(BASE + routes.admin.webhookRequests.create.action.href(), {
      method: 'POST',
      headers: formHeaders(),
      body: body.toString(),
    })
    assert.equal(response.status, 303)

    let prefix = routes.admin.webhookRequests.index.href() + '?editing='
    let location = response.headers.get('Location') ?? ''
    assert.ok(location.startsWith(prefix), 'should redirect to the created row')
    let id = location.slice(prefix.length)
    assert.ok(UUID_RE.test(id), 'redirect should carry the new uuid')

    let row = await getWebhookRequest(db, id)
    assert.ok(row, 'row should be persisted')
    assert.equal(row?.payload.test, 'created')
    assert.equal(await readFlash('success'), 'Webhook erstellt.')

    await pool.query('DELETE FROM webhook_requests WHERE id = $1', [id])
  })

  it('PUT /admin/webhook-requests/:id updates the payload and preserves grid state', async () => {
    let id = await insertRow('update-before')
    let body = new URLSearchParams({
      _csrf: csrfToken,
      _method: 'PUT',
      payload: JSON.stringify({ test: 'update-after' }),
      _offset: '15',
      _sort: 'source_ip',
      _order: 'asc',
      _filter: 'garten',
    })
    let response = await router.fetch(BASE + routes.admin.webhookRequests.update.href({ id }), {
      method: 'POST',
      headers: formHeaders(),
      body: body.toString(),
    })
    assert.equal(response.status, 303)
    assert.equal(
      response.headers.get('Location'),
      routes.admin.webhookRequests.index.href() +
        '?offset=15&sort=source_ip&order=asc&filter=garten&editing=' +
        id,
    )

    let row = await getWebhookRequest(db, id)
    assert.equal(row?.payload.test, 'update-after')
    assert.equal(await readFlash('success'), 'Webhook gespeichert.')
  })

  it('POST /admin/webhook-requests/:id/resend records a Hermes failure', async () => {
    let id = await insertRow('resend-failure')
    let previous = process.env.HERMES_URL
    process.env.HERMES_URL = 'http://127.0.0.1:1/webhooks/app-webhook'
    try {
      let body = new URLSearchParams({ _csrf: csrfToken })
      let response = await router.fetch(
        BASE +
          routes.admin.webhookRequests.resend.href({ id }) +
          '?offset=0&sort=created_at&order=desc',
        { method: 'POST', headers: formHeaders(), body: body.toString() },
      )
      assert.equal(response.status, 303)
      assert.equal(
        response.headers.get('Location'),
        routes.admin.webhookRequests.index.href() + '?offset=0&sort=created_at&order=desc',
      )

      let row = await getWebhookRequest(db, id)
      assert.equal(row?.hermes_status, 'error')
      assert.equal(await readFlash('error'), 'Senden an Hermes fehlgeschlagen (error).')
    } finally {
      if (previous === undefined) delete process.env.HERMES_URL
      else process.env.HERMES_URL = previous
    }
  })

  it('GET /admin/webhook-requests/:id/resend PRGs to the grid preserving grid state', async () => {
    let id = await insertRow('resend-resolve')
    let response = await router.fetch(
      BASE +
        routes.admin.webhookRequests.resendResolve.href({ id }) +
        '?offset=0&sort=created_at&order=desc&filter=',
      { headers: authHeaders() },
    )
    assert.equal(response.status, 303)
    assert.equal(
      response.headers.get('Location'),
      routes.admin.webhookRequests.index.href() + '?offset=0&sort=created_at&order=desc',
    )
  })

  it('GET /admin/webhook-requests/:id renders the grid with the edit panel', async () => {
    let id = await insertRow('show-resolve')
    let response = await router.fetch(BASE + routes.admin.webhookRequests.show.href({ id }), {
      headers: authHeaders(),
    })
    assert.equal(response.status, 200)
    let html = await response.text()
    assertSingleTopLevelHtml(html)
    assert.ok(html.includes('Filter (Payload)'), 'should render the grid page')
  })

  it('GET /admin/webhook-requests/:id redirects to the grid for unknown or invalid ids', async () => {
    let missing = await router.fetch(
      BASE + routes.admin.webhookRequests.show.href({ id: crypto.randomUUID() }),
      { headers: authHeaders() },
    )
    assert.equal(missing.status, 303)
    assert.equal(missing.headers.get('Location'), routes.admin.webhookRequests.index.href())

    let invalid = await router.fetch(
      BASE + routes.admin.webhookRequests.show.href({ id: 'not-a-uuid' }),
      { headers: authHeaders() },
    )
    assert.equal(invalid.status, 303)
    assert.equal(invalid.headers.get('Location'), routes.admin.webhookRequests.index.href())
  })

  it('GET /admin/webhook-requests/events streams SSE instead of hitting the :id resolver', async () => {
    let response = await router.fetch(BASE + routes.admin.webhookRequests.events.index.href(), {
      headers: authHeaders(),
    })
    assert.equal(response.status, 200)
    assert.ok(
      (response.headers.get('Content-Type') ?? '').includes('text/event-stream'),
      'events route should stream SSE',
    )
    await response.body?.cancel()
  })

  it('GET /admin/webhook-requests/events rejects non-admin sessions', async () => {
    let userAuth = await createAuthCookieWithCsrfForUser('user@newapp.com')
    assert.ok(userAuth?.cookie, 'a non-admin session should exist for the seeded user')
    let response = await router.fetch(BASE + routes.admin.webhookRequests.events.index.href(), {
      headers: { Cookie: userAuth!.cookie },
    })
    assert.equal(response.status, 403)
    await response.body?.cancel()
  })

  it('GET /admin/webhook-requests/events returns 401 without a session', async () => {
    let response = await router.fetch(BASE + routes.admin.webhookRequests.events.index.href())
    assert.equal(response.status, 401)
    await response.body?.cancel()
  })

  it('redirects the legacy /webhook-requests URLs to the admin viewer', async () => {
    let root = await router.fetch(BASE + '/webhook-requests')
    assert.equal(root.status, 308)
    assert.equal(root.headers.get('Location'), '/admin/webhook-requests')

    let nested = await router.fetch(BASE + '/webhook-requests/events?x=1')
    assert.equal(nested.status, 308)
    assert.equal(nested.headers.get('Location'), '/admin/webhook-requests/events?x=1')
  })
})
