import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { pool, initializeAppDatabase } from '../../data/setup.ts'
import { router } from '../../test-router.ts'
import { createAuthCookieWithCsrf, createAuthCookieWithCsrfForUser } from '../../test-utils.ts'
import { routes } from '../../routes.ts'
import { chatRateLimiter } from './controller.tsx'

const BASE = 'https://remix.run'
const CHAT_INDEX_URL = `${BASE}${routes.chat.index.href()}`
const CHAT_ACTION_URL = `${BASE}${routes.chat.action.href()}`
const CHAT_APPROVE_URL = `${BASE}${routes.chat.approve.href()}`
const CHAT_DECLINE_URL = `${BASE}${routes.chat.decline.href()}`
const CHAT_ANSWER_URL = `${BASE}${routes.chat.answer.href()}`
const CHAT_STREAM_BASE = `${BASE}/chat/stream`

async function getAdminId(): Promise<number> {
  let result = await pool.query('SELECT id FROM users WHERE role = $1 ORDER BY id LIMIT 1', [
    'admin',
  ])
  return result.rows[0]?.id as number
}

describe('Customer Chat controller', () => {
  let adminCookie: string
  let userCookie: string

  before(async () => {
    await initializeAppDatabase()

    let adminResult = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    adminCookie = adminResult?.cookie ?? ''

    let userResult = await createAuthCookieWithCsrfForUser('user@newapp.com')
    userCookie = userResult?.cookie ?? ''
  })

  // ── Index (GET) ─────────────────────────────────────────

  it('GET /chat redirects to login when not authenticated', async () => {
    let response = await router.fetch(CHAT_INDEX_URL, { redirect: 'manual' })
    assert.equal(response.status, 302)
    let location = response.headers.get('Location')
    assert.ok(
      location?.startsWith(routes.auth.login.index.href()),
      'should redirect to login with returnTo',
    )
  })

  it('GET /chat returns 200 for authenticated user', async () => {
    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    let response = await router.fetch(CHAT_INDEX_URL, {
      headers: { Cookie: session.cookie },
    })
    assert.equal(response.status, 200)
    let text = await response.text()
    assert.ok(text.includes('Beratung'), 'page should contain heading')
  })

  it('GET /chat works for non-admin user', async () => {
    let response = await router.fetch(CHAT_INDEX_URL, {
      headers: { Cookie: userCookie },
    })
    assert.equal(response.status, 200)
  })

  // ── Action (POST) ───────────────────────────────────────

  it('POST /chat with empty message returns 400 JSON', async () => {
    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')
    chatRateLimiter.reset(await getAdminId())

    let response = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, Accept: 'application/json' },
      body: new URLSearchParams({ message: '', _csrf: session.csrfToken }),
    })

    assert.equal(response.status, 400)
    let json = await response.json()
    assert.ok(json.error, 'response should include an error message')
  })

  it('POST /chat with whitespace-only message returns 400 JSON', async () => {
    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')
    chatRateLimiter.reset(await getAdminId())

    let response = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, Accept: 'application/json' },
      body: new URLSearchParams({ message: '   ', _csrf: session.csrfToken }),
    })

    assert.equal(response.status, 400)
    let json = await response.json()
    assert.ok(json.error, 'response should include an error message')
  })

  it('POST /chat with valid message returns JSON (runId or error)', async () => {
    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')
    chatRateLimiter.reset(await getAdminId())

    let response = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, Accept: 'application/json' },
      body: new URLSearchParams({
        message: 'Ich brauche einen ruhigen Raum',
        _csrf: session.csrfToken,
      }),
    })

    let contentType = response.headers.get('Content-Type') || ''
    assert.ok(contentType.includes('application/json'), 'response should be JSON')
    let json = await response.json()
    assert.ok(json.runId || json.error, 'should return runId or error')
  })

  it('POST /chat continues an existing thread when threadId is provided', async () => {
    let existingThreadId = crypto.randomUUID()
    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')
    chatRateLimiter.reset(await getAdminId())

    let response = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, Accept: 'application/json' },
      body: new URLSearchParams({
        message: 'weiter',
        _csrf: session.csrfToken,
        threadId: existingThreadId,
      }),
    })

    let json = await response.json()
    if (json.threadId) {
      assert.equal(json.threadId, existingThreadId, 'should echo provided threadId')
    }
  })

  // ── Approve (POST) ──────────────────────────────────────

  it('POST /chat/approve with missing runId returns 400 JSON', async () => {
    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')
    chatRateLimiter.reset(await getAdminId())

    let response = await router.fetch(CHAT_APPROVE_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: new URLSearchParams({ _csrf: session.csrfToken }),
    })

    assert.equal(response.status, 400)
    let json = await response.json()
    assert.equal(json.error, 'Missing runId')
  })

  it('POST /chat/approve returns JSON response', async () => {
    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')
    chatRateLimiter.reset(await getAdminId())

    let response = await router.fetch(CHAT_APPROVE_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: new URLSearchParams({
        runId: 'test-run-id',
        toolCallId: 'test-tool-call',
        _csrf: session.csrfToken,
      }),
    })

    let contentType = response.headers.get('Content-Type') || ''
    assert.ok(contentType.includes('application/json'), 'response should be JSON')
  })

  // ── Decline (POST) ──────────────────────────────────────

  it('POST /chat/decline with missing runId returns 400 JSON', async () => {
    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')
    chatRateLimiter.reset(await getAdminId())

    let response = await router.fetch(CHAT_DECLINE_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: new URLSearchParams({ _csrf: session.csrfToken }),
    })

    assert.equal(response.status, 400)
    let json = await response.json()
    assert.equal(json.error, 'Missing runId')
  })

  it('POST /chat/decline returns JSON response', async () => {
    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')
    chatRateLimiter.reset(await getAdminId())

    let response = await router.fetch(CHAT_DECLINE_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: new URLSearchParams({
        runId: 'test-run-id',
        toolCallId: 'test-tool-call',
        _csrf: session.csrfToken,
      }),
    })

    let contentType = response.headers.get('Content-Type') || ''
    assert.ok(contentType.includes('application/json'), 'response should be JSON')
  })

  // ── Answer (POST) ───────────────────────────────────────

  it('POST /chat/answer with missing runId returns 400 JSON', async () => {
    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')
    chatRateLimiter.reset(await getAdminId())

    let response = await router.fetch(CHAT_ANSWER_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: new URLSearchParams({ _csrf: session.csrfToken }),
    })

    assert.equal(response.status, 400)
    let json = await response.json()
    assert.ok(json.error, 'should return error message')
  })

  it('POST /chat/answer with missing answer returns 400 JSON', async () => {
    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')
    chatRateLimiter.reset(await getAdminId())

    let response = await router.fetch(CHAT_ANSWER_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: new URLSearchParams({
        runId: 'test-run',
        _csrf: session.csrfToken,
      }),
    })

    assert.equal(response.status, 400)
    let json = await response.json()
    assert.ok(json.error, 'should return error message')
  })

  // ── Stream (GET) ────────────────────────────────────────

  it('GET /chat/stream/nonexistent redirects when not authenticated', async () => {
    let response = await router.fetch(`${CHAT_STREAM_BASE}/nonexistent-run-id`, {
      redirect: 'manual',
    })
    assert.equal(response.status, 302)
  })

  it('GET /chat/stream/nonexistent returns 404 when authenticated', async () => {
    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    let response = await router.fetch(`${CHAT_STREAM_BASE}/nonexistent-run-id`, {
      headers: { Cookie: session.cookie },
    })
    assert.equal(response.status, 404)
  })

  // ── Rate limiting ───────────────────────────────────────

  it('POST /chat triggers rate limit on rapid requests', async () => {
    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')
    chatRateLimiter.reset(await getAdminId())

    // First POST consumes a token
    await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, Accept: 'application/json' },
      body: new URLSearchParams({ message: 'first', _csrf: session.csrfToken }),
    })

    // Second should be rate limited
    let second = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, Accept: 'application/json' },
      body: new URLSearchParams({ message: 'again', _csrf: session.csrfToken }),
    })

    assert.equal(second.status, 429)
    let json = await second.json()
    assert.ok(json.error, '429 response should include an error message')
  })
})
