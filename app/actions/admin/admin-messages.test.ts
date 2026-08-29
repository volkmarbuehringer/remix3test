import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'
import { CacheControl, ContentType } from 'remix/headers'

import { db, initializeAppDatabase } from '../../db.ts'
import { pool } from '../../data/test-pool.ts'
import { sql } from 'remix/data-table'
import { router } from '../../test-router.ts'
import { createAuthCookieWithCsrf, createAuthCookieWithCsrfForUser } from '../../test-utils.ts'
import { routes } from '../../routes.ts'

// ---------------------------------------------------------------------------
// Admin Messages Controller integration tests
// Requires a running PostgreSQL database seeded with demo users.
// ---------------------------------------------------------------------------

const BASE = 'https://remix.run'
const LOGIN_URL = `${BASE}${routes.auth.login.index.href()}`
const ADMIN_MESSAGES_URL = `${BASE}/admin/messages`

describe('Admin Messages controller', () => {
  let adminCookie: string
  let userCookie: string

  before(async () => {
    await initializeAppDatabase()

    // Admin auth — login as admin@newapp.com
    let adminResult = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    adminCookie = adminResult?.cookie ?? ''

    // User auth — login as user@newapp.com
    let userResult = await createAuthCookieWithCsrfForUser('user@newapp.com')
    userCookie = userResult?.cookie ?? ''
  })

  /** Make an authenticated GET request to the admin messages endpoint. */
  async function adminMessagesGet(queryString?: string): Promise<Response> {
    let url = queryString ? `${ADMIN_MESSAGES_URL}?${queryString}` : ADMIN_MESSAGES_URL
    return await router.fetch(url, {
      headers: { Cookie: adminCookie },
    })
  }

  it('GET /admin/messages redirects to login when not authenticated', async () => {
    let response = await router.fetch(ADMIN_MESSAGES_URL)
    assert.equal(response.status, 302)
    let location = response.headers.get('Location')
    assert.ok(
      location?.startsWith(routes.auth.login.index.href()),
      'should redirect to login with returnTo',
    )
    assert.ok(location?.includes('returnTo='), 'should capture return path')
  })

  it('GET /admin/messages returns 200 for admin', async () => {
    let response = await router.fetch(ADMIN_MESSAGES_URL, {
      headers: { Cookie: adminCookie },
    })
    assert.equal(response.status, 200)
  })

  it('GET /admin/messages returns 403 for non-admin user', async () => {
    let response = await router.fetch(ADMIN_MESSAGES_URL, {
      headers: { Cookie: userCookie },
    })
    assert.equal(response.status, 403)
  })

  it('GET /admin/messages includes messages in response', async () => {
    let response = await router.fetch(ADMIN_MESSAGES_URL, {
      headers: { Cookie: adminCookie },
    })
    let text = await response.text()
    assert.ok(text.includes('Messages'), 'response should mention Messages')
  })

  it('GET /admin/messages shows empty state when no messages match', async () => {
    // Use a large offset to get no messages
    let response = await router.fetch(`${ADMIN_MESSAGES_URL}?offset=99999`, {
      headers: { Cookie: adminCookie },
    })
    let text = await response.text()
    assert.ok(text.includes('Noch keine Nachrichten'), 'response should show empty state')
  })

  it('POST /admin/messages rejects empty content', async () => {
    // Get admin session with CSRF token
    let session = await createAuthCookieWithCsrf()
    if (!session) throw new Error('Failed to create auth session')

    let formData = new FormData()
    formData.set('content', '')
    formData.set('_csrf', session.csrfToken)
    let response = await router.fetch(ADMIN_MESSAGES_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: formData,
    })
    assert.equal(response.status, 400)
  })

  it('POST /admin/messages creates a new message', async () => {
    let session = await createAuthCookieWithCsrf()
    if (!session) throw new Error('Failed to create auth session')

    let formData = new FormData()
    formData.set('content', 'Test message from admin')
    formData.set('_csrf', session.csrfToken)
    let response = await router.fetch(ADMIN_MESSAGES_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: formData,
      redirect: 'manual',
    })

    // Should redirect back to messages after creation
    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/admin/messages')
  })

  it('POST /admin/messages with sanitizable content creates message (after rate limit window)', async () => {
    // Wait for rate limit window to clear (500ms)
    await new Promise((r) => setTimeout(r, 600))

    let session = await createAuthCookieWithCsrf()
    if (!session) throw new Error('Failed to create auth session')

    let formData = new FormData()
    formData.set('content', 'Hello <b>World</b> & welcome')
    formData.set('_csrf', session.csrfToken)
    let response = await router.fetch(ADMIN_MESSAGES_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: formData,
      redirect: 'manual',
    })
    assert.equal(response.status, 302)
    assert.match(response.headers.get('Location') ?? '', /\/admin\/messages$/)
  })

  it('POST /admin/messages/:id/delete removes a message', async () => {
    let session = await createAuthCookieWithCsrf()
    if (!session) throw new Error('Failed to create auth session')

    // First create a message to delete
    let now = Date.now()
    let createResult = await pool.query(
      `INSERT INTO messages (sender_id, content, created_at) VALUES ((SELECT id FROM users WHERE email = 'admin@newapp.com'), 'To be deleted', $1) RETURNING id`,
      [now],
    )
    let messageId = createResult.rows[0].id as number

    // Delete it
    let formData = new FormData()
    formData.set('_csrf', session.csrfToken)
    let response = await router.fetch(`${ADMIN_MESSAGES_URL}/${messageId}/delete`, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: formData,
      redirect: 'manual',
    })

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/admin/messages')

    // Verify deleted
    let check = await pool.query(`SELECT id FROM messages WHERE id = $1`, [messageId])
    assert.equal(check.rows.length, 0, 'message should be deleted')
  })

  it('POST /admin/messages/0/delete returns 400 for invalid ID', async () => {
    let session = await createAuthCookieWithCsrf()
    if (!session) throw new Error('Failed to create auth session')

    let formData = new FormData()
    formData.set('_csrf', session.csrfToken)
    let response = await router.fetch(`${ADMIN_MESSAGES_URL}/0/delete`, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: formData,
    })
    assert.equal(response.status, 400)
  })

  it('GET /admin/messages/subscribe returns SSE stream with correct headers', async () => {
    let response = await router.fetch(`${ADMIN_MESSAGES_URL}/subscribe`, {
      headers: { Cookie: adminCookie },
    })
    assert.equal(response.status, 200)
    assert.equal(
      ContentType.from(response.headers.get('Content-Type')).mediaType,
      'text/event-stream',
    )
    assert.ok(CacheControl.from(response.headers.get('Cache-Control')).noCache)
    assert.equal(response.headers.get('Connection'), 'keep-alive')
    assert.equal(response.headers.get('X-Accel-Buffering'), 'no')
  })

  it('GET /admin/messages/subscribe streams initial connected event', async () => {
    let controller = new AbortController()
    let response = await router.fetch(`${ADMIN_MESSAGES_URL}/subscribe`, {
      headers: { Cookie: adminCookie },
      signal: controller.signal,
    })

    let reader = response.body!.getReader()
    let { value, done } = await reader.read()
    controller.abort()
    reader.cancel()

    assert.equal(done, false)
    let text = new TextDecoder().decode(value)
    assert.ok(text.includes('event: connected'), 'should send initial connected event')
    assert.ok(text.includes('"status":"connected"'), 'should include connection status')
  })

  it('GET /admin/messages/subscribe redirects when not authenticated', async () => {
    let response = await router.fetch(`${ADMIN_MESSAGES_URL}/subscribe`)
    assert.equal(response.status, 302)
    let location = response.headers.get('Location')
    assert.ok(
      location?.startsWith(routes.auth.login.index.href()),
      'should redirect to login with returnTo',
    )
    assert.ok(location?.includes('returnTo='), 'should capture return path')
  })

  it('broadcastInvalidate does not throw when there are no active subscribers', async () => {
    // Directly call broadcastInvalidate with no active SSE subscribers.
    // This validates the new channel infra gracefully handles empty subscriber sets.
    let { broadcastInvalidate } = await import('../../utils/messages-sse.ts')
    broadcastInvalidate()
    // If we reach here without an exception, the broadcast was clean.
    assert.ok(true)
  })

  // -----------------------------------------------------------------------
  // Grid rendering — shared admin-table data grid
  // -----------------------------------------------------------------------

  it('GET /admin/messages renders the messages data grid', async () => {
    let response = await adminMessagesGet()
    let text = await response.text()

    assert.ok(text.includes('data-messages-table'), 'grid wrapper should be present')
    assert.ok(text.includes('<table'), 'should render a data table')
    assert.ok(text.includes('Absender'), 'should render the Absender column header')
    assert.ok(text.includes('Erstellt'), 'should render the Erstellt column header')
    assert.ok(text.includes('Aktionen'), 'should render the Aktionen column header')
  })

  it('GET /admin/messages renders the compose panel', async () => {
    let response = await adminMessagesGet()
    let text = await response.text()

    assert.ok(text.includes('Neue Nachricht senden'), 'compose panel should render')
    assert.ok(text.includes('Nachricht senden'), 'submit button should render')
  })

  // -----------------------------------------------------------------------
  // Pagination — offset-based (matches the other admin grid routes)
  // -----------------------------------------------------------------------

  it('GET /admin/messages?offset=10 renders the requested page number', async () => {
    // With only a few seeded messages a non-zero offset renders an empty grid,
    // but the pagination bar still shows the computed "Seite N" badge + back link.
    let response = await adminMessagesGet('offset=10')

    assert.equal(response.status, 200)
    let text = await response.text()
    assert.ok(text.includes('Seite 2'), 'should render the requested page number')
    assert.ok(text.includes('Zurück'), 'should show a back link when offset > 0')
  })

  it('GET /admin/messages?offset=-5 falls back to offset 0', async () => {
    let response = await adminMessagesGet('offset=-5')

    assert.equal(response.status, 200)
    let text = await response.text()
    assert.ok(!text.includes('Zurück'), 'should not show a back link at offset 0')
  })

  it('GET /admin/messages?offset=abc falls back to offset 0', async () => {
    let response = await adminMessagesGet('offset=abc')

    assert.equal(response.status, 200)
    let text = await response.text()
    assert.ok(!text.includes('Zurück'), 'should fall back to offset 0 for non-numeric input')
  })

  // -----------------------------------------------------------------------
  // POST /admin/messages/:id/delete — preserves the current offset
  // -----------------------------------------------------------------------

  it('POST /admin/messages/:id/delete preserves the current offset in the redirect', async () => {
    let session = await createAuthCookieWithCsrf()
    if (!session) throw new Error('Failed to create auth session')

    let now = Date.now()
    let createResult = await pool.query(
      `INSERT INTO messages (sender_id, content, created_at) VALUES ((SELECT id FROM users WHERE email = 'admin@newapp.com'), 'Delete me (offset)', $1) RETURNING id`,
      [now],
    )
    let messageId = createResult.rows[0].id as number

    let formData = new FormData()
    formData.set('_csrf', session.csrfToken)
    formData.set('_offset', '10')
    let response = await router.fetch(`${ADMIN_MESSAGES_URL}/${messageId}/delete`, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: formData,
      redirect: 'manual',
    })

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/admin/messages?offset=10')
  })

  // -----------------------------------------------------------------------
  // GET /admin/messages/:id/delete — frame action-path resolver
  //
  // The frame runtime commits the POST delete form's action path as the
  // frame src after submission, and the live ConnectionIndicator reloads it
  // on invalidate. That GET must resolve (form action == frame src) rather
  // than 404 on the POST-only delete route.
  // -----------------------------------------------------------------------

  it('GET /admin/messages/:id/delete resolves to the messages list (no 404)', async () => {
    let response = await router.fetch(`${ADMIN_MESSAGES_URL}/1/delete`, {
      headers: { Cookie: adminCookie },
    })

    assert.equal(response.status, 200)
    let text = await response.text()
    assert.ok(text.includes('Nachrichten'), 'should render the messages list')
    assert.ok(text.includes('data-messages-table'), 'should render the data grid')
  })
})
