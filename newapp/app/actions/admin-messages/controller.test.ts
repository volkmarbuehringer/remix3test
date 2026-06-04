import { describe, it, before, after } from 'remix/test'
import * as assert from 'remix/assert'

import { db, initializeAppDatabase, pool } from '../../data/setup.ts'
import { sql } from 'remix/data-table'
import { router } from '../../router.ts'
import { createAuthCookieWithCsrf, createAuthCookieWithCsrfForUser } from '../../test-utils.ts'

// ---------------------------------------------------------------------------
// Admin Messages Controller integration tests
// Requires a running PostgreSQL database seeded with demo users.
// ---------------------------------------------------------------------------

const BASE = 'https://remix.run'
const LOGIN_URL = `${BASE}/login`
const ADMIN_MESSAGES_URL = `${BASE}/admin/messages`

describe('Admin Messages controller', () => {
  let adminCookie: string
  let userCookie: string
  let testMessageIds: number[] = []

  before(async () => {
    await initializeAppDatabase()

    // Clean up any leftover test messages from previous runs
    if (testMessageIds.length > 0) {
      for (let id of testMessageIds) {
        await db.exec(sql`DELETE FROM messages WHERE id = ${id}`)
      }
    }

    // Admin auth — login as admin@newapp.com
    let adminResult = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    adminCookie = adminResult?.cookie ?? ''

    // User auth — login as user@newapp.com
    let userResult = await createAuthCookieWithCsrfForUser('user@newapp.com')
    userCookie = userResult?.cookie ?? ''
  })

  after(async () => {
    // Clean up test messages
    for (let id of testMessageIds) {
      try {
        await db.exec(sql`DELETE FROM messages WHERE id = ${id}`)
      } catch { /* ignore cleanup errors */ }
    }
  })

  it('GET /admin/messages redirects to login when not authenticated', async () => {
    let response = await router.fetch(ADMIN_MESSAGES_URL)
    assert.equal(response.status, 302)
    let location = response.headers.get('Location')
    assert.ok(location?.startsWith('/login'), 'should redirect to /login with returnTo')
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

    // Find and track our test message for cleanup
    let result = await pool.query(
      `SELECT id FROM messages WHERE content = 'Test message from admin' ORDER BY created_at DESC LIMIT 1`,
    )
    if (result.rows.length > 0) {
      testMessageIds.push(result.rows[0].id)
    }
  })

  it('POST /admin/messages with sanitizable content creates message (after rate limit window)', async () => {
    // Wait for rate limit window to clear (500ms)
    await new Promise(r => setTimeout(r, 600))

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
    testMessageIds.push(messageId)

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
    assert.equal(response.headers.get('Content-Type'), 'text/event-stream')
    assert.equal(response.headers.get('Cache-Control'), 'no-cache')
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
    assert.ok(location?.startsWith('/login'), 'should redirect to /login with returnTo')
    assert.ok(location?.includes('returnTo='), 'should capture return path')
  })

  it('broadcastInvalidate does not throw when there are no active subscribers', async () => {
    // Directly call broadcastInvalidate with no active SSE subscribers.
    // This validates the new channel infra gracefully handles empty subscriber sets.
    let { broadcastInvalidate } = await import('../../lib/messages-sse.ts')
    broadcastInvalidate()
    // If we reach here without an exception, the broadcast was clean.
    assert.ok(true)
  })
})
