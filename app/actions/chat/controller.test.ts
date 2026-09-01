import { describe, it, before, afterEach, after } from 'remix/test'
import * as assert from 'remix/assert'

import { initializeAppDatabase } from '../../db.ts'
import { pool } from '../../data/test-pool.ts'
import { router } from '../../test-router.ts'
import { createAuthCookieWithCsrf, createAuthCookieWithCsrfForUser } from '../../test-utils.ts'
import { routes } from '../../routes.ts'
import { __setTestAgent, __setTestResumeResolver, chatRateLimiter } from './controller.tsx'
import { recordChatRun, findChatRunOwner } from './run-store.ts'
import type { AgentStreamOutput } from '../mastra/shared-agent.ts'

const BASE = 'https://remix.run'
const CHAT_INDEX_URL = `${BASE}${routes.chat.index.href()}`
const CHAT_ACTION_URL = `${BASE}${routes.chat.action.href()}`
const CHAT_APPROVE_URL = `${BASE}${routes.chat.approve.href()}`
const CHAT_DECLINE_URL = `${BASE}${routes.chat.decline.href()}`
const CHAT_ANSWER_URL = `${BASE}${routes.chat.answer.href()}`

const SSE_HEADERS = { Accept: 'text/event-stream', 'X-Sse-Request': '1' }

async function getUserId(email: string): Promise<number> {
  let result = await pool.query('SELECT id FROM users WHERE email = $1', [email])
  return result.rows[0]?.id as number
}

async function parseSSEResponse(
  response: Response,
): Promise<{ events: Array<{ type: string; data: string }>; text: string }> {
  let events: Array<{ type: string; data: string }> = []
  let text = ''
  let body = response.body
  if (!body) return { events, text }

  let reader = body.getReader()
  let decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    let { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let parts = buffer.split('\n\n')
    buffer = parts.pop() || ''
    for (let part of parts) {
      let lines = part.split('\n')
      let eventType = 'message'
      let data = ''
      for (let line of lines) {
        if (line.startsWith('event: ')) eventType = line.slice(7)
        else if (line.startsWith('data: ')) data = line.slice(6)
      }
      events.push({ type: eventType, data })
      if (eventType === 'message') {
        try {
          let parsed = JSON.parse(data)
          text += parsed.text || ''
        } catch {
          text += data
        }
      }
    }
  }
  return { events, text }
}

function createMockStreamOutput(text: string, runId?: string): AgentStreamOutput {
  let id = runId || crypto.randomUUID()
  return {
    runId: id,
    fullStream: new ReadableStream({
      start(controller) {
        if (text) {
          controller.enqueue({ type: 'text-delta', textDelta: text })
        }
        controller.enqueue({ type: 'finish', payload: {} })
        controller.close()
      },
    }),
    getFullOutput: async () => ({ text, finishReason: 'stop' }),
  }
}

type MockAgent = {
  generate: (message: string, opts?: Record<string, unknown>) => Promise<{ text: string }>
  stream: (message: string, opts?: any) => Promise<AgentStreamOutput>
  resumeStream: (data: unknown, opts?: any) => Promise<AgentStreamOutput>
  approveToolCallGenerate?: (opts: { runId: string; toolCallId?: string }) => Promise<{
    text: string
    finishReason: string
    runId: string
  }>
  declineToolCallGenerate?: (opts: { runId: string; toolCallId?: string }) => Promise<{
    text: string
    finishReason: string
    runId: string
  }>
}

function makeMockAgent(overrides?: Partial<MockAgent>): MockAgent {
  return {
    generate: async () => ({ text: '' }),
    stream: async () => createMockStreamOutput('Hier ist die Antwort.'),
    resumeStream: async () => createMockStreamOutput('Fortsetzung.'),
    approveToolCallGenerate: async () => ({
      text: 'Bestätigt.',
      finishReason: 'stop',
      runId: crypto.randomUUID(),
    }),
    declineToolCallGenerate: async () => ({
      text: 'Die Aktion wurde abgelehnt.',
      finishReason: 'stop',
      runId: crypto.randomUUID(),
    }),
    ...overrides,
  }
}

describe('Customer Chat controller', () => {
  let adminCookie: string
  let userCookie: string
  let mockAgent: MockAgent

  before(async () => {
    await initializeAppDatabase()

    let adminResult = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    adminCookie = adminResult?.cookie ?? ''
    let userResult = await createAuthCookieWithCsrfForUser('user@newapp.com')
    userCookie = userResult?.cookie ?? ''
  })

  afterEach(async () => {
    await pool.query('DELETE FROM chat_runs')
    __setTestAgent(undefined)
    __setTestResumeResolver(undefined)
  })

  after(async () => {
    __setTestAgent(undefined)
    __setTestResumeResolver(undefined)
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
    mockAgent = makeMockAgent()
    __setTestAgent(mockAgent)

    let response = await router.fetch(CHAT_INDEX_URL, {
      headers: { Cookie: session.cookie },
    })
    assert.equal(response.status, 200)
    let text = await response.text()
    assert.ok(text.includes('Beratung'), 'page should contain heading')
  })

  it('GET /chat renders an empty conversation when no history is available', async () => {
    mockAgent = makeMockAgent()
    __setTestAgent(mockAgent)

    let response = await router.fetch(CHAT_INDEX_URL, {
      headers: { Cookie: userCookie },
    })
    assert.equal(response.status, 200)
    let text = await response.text()
    // No recallable history (mock agent has no memory): no thread id, no bubbles.
    assert.ok(!text.includes('data-thread-id'), 'should not expose a thread id')
    assert.ok(
      !text.includes('Hallo aus der Vergangenheit'),
      'should not re-render recalled history',
    )
  })

  it('GET /chat rehydrates the latest conversation and resumes the thread', async () => {
    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')
    __setTestResumeResolver(async () => ({
      threadId: 'thread-resume-1',
      messages: [
        { role: 'user', content: 'Hallo aus der Vergangenheit', timestamp: 1 },
        { role: 'assistant', content: 'Antwort aus der Vergangenheit', timestamp: 2 },
      ],
    }))

    let response = await router.fetch(CHAT_INDEX_URL, {
      headers: { Cookie: session.cookie },
    })
    assert.equal(response.status, 200)
    let text = await response.text()
    assert.ok(
      text.includes('data-thread-id="thread-resume-1"'),
      'should expose the resumed thread id',
    )
    assert.ok(
      text.includes('Hallo aus der Vergangenheit'),
      'should render the recalled user message',
    )
    assert.ok(
      text.includes('Antwort aus der Vergangenheit'),
      'should render the recalled assistant message',
    )
  })

  it('GET /chat?new=1 starts a fresh conversation even when a thread exists', async () => {
    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')
    __setTestResumeResolver(async () => ({
      threadId: 'thread-old',
      messages: [{ role: 'user', content: 'alte Nachricht', timestamp: 1 }],
    }))

    let response = await router.fetch(`${CHAT_INDEX_URL}?new=1`, {
      headers: { Cookie: session.cookie },
    })
    assert.equal(response.status, 200)
    let text = await response.text()
    assert.ok(!text.includes('data-thread-id'), 'fresh conversation should not expose a thread id')
    assert.ok(!text.includes('alte Nachricht'), 'fresh conversation should not re-render history')
  })

  // ── CSRF / transport ────────────────────────────────────

  it('POST /chat without X-Sse-Request header is forbidden', async () => {
    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    let response = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: new URLSearchParams({ message: 'hi' }),
    })
    assert.equal(response.status, 403)
  })

  // ── Action (POST) ───────────────────────────────────────

  it('POST /chat with empty message returns 400 SSE agent-error', async () => {
    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')
    chatRateLimiter.reset(await getUserId('admin@newapp.com'))

    let response = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, ...SSE_HEADERS },
      body: new URLSearchParams({ message: '' }),
    })
    assert.equal(response.status, 400)
    let { events } = await parseSSEResponse(response)
    assert.ok(
      events.find((e) => e.type === 'agent-error'),
      'should emit agent-error',
    )
  })

  it('POST /chat with whitespace-only message returns 400 SSE agent-error', async () => {
    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')
    chatRateLimiter.reset(await getUserId('admin@newapp.com'))

    let response = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, ...SSE_HEADERS },
      body: new URLSearchParams({ message: '   ' }),
    })
    assert.equal(response.status, 400)
    let { events } = await parseSSEResponse(response)
    assert.ok(
      events.find((e) => e.type === 'agent-error'),
      'should emit agent-error',
    )
  })

  it('POST /chat with valid message streams SSE response text', async () => {
    let adminId = await getUserId('admin@newapp.com')
    chatRateLimiter.reset(adminId)

    mockAgent = makeMockAgent()
    __setTestAgent(mockAgent)

    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    let response = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, ...SSE_HEADERS },
      body: new URLSearchParams({ message: 'Ich brauche einen ruhigen Raum' }),
    })

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Content-Type'), 'text/event-stream')

    let { events, text } = await parseSSEResponse(response)
    assert.equal(events[0]?.type, 'start', 'first event should be start')
    assert.ok(JSON.parse(events[0]?.data ?? '{}').runId, 'start event should include runId')
    assert.equal(text, 'Hier ist die Antwort.')
    assert.ok(
      events.find((e) => e.type === 'complete'),
      'should have a complete event',
    )
  })

  it('POST /chat passes threadId and continues the same thread', async () => {
    let adminId = await getUserId('admin@newapp.com')
    chatRateLimiter.reset(adminId)

    mockAgent = makeMockAgent()
    __setTestAgent(mockAgent)

    let existingThreadId = crypto.randomUUID()
    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    let response = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, ...SSE_HEADERS },
      body: new URLSearchParams({ message: 'weiter', threadId: existingThreadId }),
    })

    assert.equal(response.status, 200)
    let { events } = await parseSSEResponse(response)
    let startEvent = events.find((e) => e.type === 'start')
    assert.ok(startEvent, 'should emit start')
    assert.equal(
      (JSON.parse(startEvent!.data) as { threadId?: string }).threadId,
      existingThreadId,
      'should echo provided threadId',
    )
  })

  // ── Approve (POST) ──────────────────────────────────────

  it('POST /chat/approve with missing runId returns 400 SSE agent-error', async () => {
    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')
    chatRateLimiter.reset(await getUserId('admin@newapp.com'))

    let response = await router.fetch(CHAT_APPROVE_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, ...SSE_HEADERS },
      body: new URLSearchParams({}),
    })
    assert.equal(response.status, 400)
    let { events } = await parseSSEResponse(response)
    assert.ok(
      events.find((e) => e.type === 'agent-error'),
      'should emit agent-error',
    )
  })

  it('POST /chat/approve is rejected for a run owned by another user', async () => {
    let adminId = await getUserId('admin@newapp.com')
    let otherUserId = await getUserId('user@newapp.com')
    chatRateLimiter.reset(adminId)

    let runId = crypto.randomUUID()
    await recordChatRun({ runId, userId: otherUserId, threadId: 't' })

    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    let response = await router.fetch(CHAT_APPROVE_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, ...SSE_HEADERS },
      body: new URLSearchParams({ runId, toolCallId: 'tc' }),
    })
    assert.equal(response.status, 403)
  })

  it('POST /chat/approve streams for the owning user', async () => {
    let adminId = await getUserId('admin@newapp.com')
    chatRateLimiter.reset(adminId)

    mockAgent = makeMockAgent()
    __setTestAgent(mockAgent)

    let runId = crypto.randomUUID()
    await recordChatRun({ runId, userId: adminId, threadId: 't' })

    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    let response = await router.fetch(CHAT_APPROVE_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, ...SSE_HEADERS },
      body: new URLSearchParams({ runId, toolCallId: 'tc' }),
    })
    assert.equal(response.status, 200)
    let { events, text } = await parseSSEResponse(response)
    assert.equal(text, 'Bestätigt.')
    assert.ok(
      events.find((e) => e.type === 'complete'),
      'should have a complete event',
    )
  })

  it('POST /chat/approve records ownership for a re-suspended continuation run', async () => {
    let adminId = await getUserId('admin@newapp.com')
    chatRateLimiter.reset(adminId)

    let contRunId = crypto.randomUUID()
    mockAgent = makeMockAgent({
      approveToolCallGenerate: async () => ({
        text: '',
        finishReason: 'suspended',
        runId: contRunId,
        suspendPayload: { toolCallId: 'tc2', toolName: 'book', args: {} },
      }),
    })
    __setTestAgent(mockAgent)

    let runId = crypto.randomUUID()
    await recordChatRun({ runId, userId: adminId, threadId: 't' })

    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    let response = await router.fetch(CHAT_APPROVE_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, ...SSE_HEADERS },
      body: new URLSearchParams({ runId, toolCallId: 'tc' }),
    })

    // Consume the stream so the async start() (which records the continuation
    // run) actually runs.
    let { events } = await parseSSEResponse(response)
    assert.equal(response.status, 200)
    assert.ok(
      events.find((e) => e.type === 'suspension'),
      'should emit a suspension event',
    )

    // The continuation run must have a durable ownership row so a follow-up
    // approve/decline/answer on it is not rejected.
    let owner = await findChatRunOwner(contRunId)
    assert.ok(owner, 'continuation run should have an ownership row')
    assert.equal(owner!.userId, adminId)
  })

  // ── Decline (POST) ──────────────────────────────────────

  it('POST /chat/decline with missing runId returns 400 SSE agent-error', async () => {
    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')
    chatRateLimiter.reset(await getUserId('admin@newapp.com'))

    let response = await router.fetch(CHAT_DECLINE_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, ...SSE_HEADERS },
      body: new URLSearchParams({}),
    })
    assert.equal(response.status, 400)
    let { events } = await parseSSEResponse(response)
    assert.ok(
      events.find((e) => e.type === 'agent-error'),
      'should emit agent-error',
    )
  })

  it('POST /chat/decline streams for the owning user', async () => {
    let adminId = await getUserId('admin@newapp.com')
    chatRateLimiter.reset(adminId)

    mockAgent = makeMockAgent()
    __setTestAgent(mockAgent)

    let runId = crypto.randomUUID()
    await recordChatRun({ runId, userId: adminId, threadId: 't' })

    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    let response = await router.fetch(CHAT_DECLINE_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, ...SSE_HEADERS },
      body: new URLSearchParams({ runId, toolCallId: 'tc' }),
    })
    assert.equal(response.status, 200)
    let { text } = await parseSSEResponse(response)
    assert.equal(text, 'Die Aktion wurde abgelehnt.')
  })

  // ── Answer (POST) ───────────────────────────────────────

  it('POST /chat/answer with missing runId returns 400 SSE agent-error', async () => {
    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')
    chatRateLimiter.reset(await getUserId('admin@newapp.com'))

    let response = await router.fetch(CHAT_ANSWER_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, ...SSE_HEADERS },
      body: new URLSearchParams({}),
    })
    assert.equal(response.status, 400)
    let { events } = await parseSSEResponse(response)
    assert.ok(
      events.find((e) => e.type === 'agent-error'),
      'should emit agent-error',
    )
  })

  it('POST /chat/answer with missing answer returns 400 SSE agent-error', async () => {
    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')
    chatRateLimiter.reset(await getUserId('admin@newapp.com'))

    let response = await router.fetch(CHAT_ANSWER_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, ...SSE_HEADERS },
      body: new URLSearchParams({ runId: 'test-run' }),
    })
    assert.equal(response.status, 400)
    let { events } = await parseSSEResponse(response)
    assert.ok(
      events.find((e) => e.type === 'agent-error'),
      'should emit agent-error',
    )
  })

  it('POST /chat/answer streams for the owning user', async () => {
    let adminId = await getUserId('admin@newapp.com')
    chatRateLimiter.reset(adminId)

    mockAgent = makeMockAgent()
    __setTestAgent(mockAgent)

    let runId = crypto.randomUUID()
    await recordChatRun({ runId, userId: adminId, threadId: 't' })

    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    let response = await router.fetch(CHAT_ANSWER_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, ...SSE_HEADERS },
      body: new URLSearchParams({ runId, answer: 'ja', selectionMode: 'single_select' }),
    })
    assert.equal(response.status, 200)
    let { text } = await parseSSEResponse(response)
    assert.equal(text, 'Fortsetzung.')
  })

  it('POST /chat/answer preserves ownership for a same-run continuation', async () => {
    let adminId = await getUserId('admin@newapp.com')
    chatRateLimiter.reset(adminId)

    let runId = crypto.randomUUID()
    mockAgent = makeMockAgent({
      resumeStream: async () => createMockStreamOutput('Fortsetzung.', runId),
    })
    __setTestAgent(mockAgent)
    await recordChatRun({ runId, userId: adminId, threadId: 't' })

    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    let response = await router.fetch(CHAT_ANSWER_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, ...SSE_HEADERS },
      body: new URLSearchParams({ runId, answer: 'ja', selectionMode: 'single_select' }),
    })
    let { text } = await parseSSEResponse(response)
    assert.equal(response.status, 200)
    assert.equal(text, 'Fortsetzung.')

    // The same run continued, so its ownership row must remain, or a follow-up
    // approve/decline/answer on it would be rejected (403).
    let owner = await findChatRunOwner(runId)
    assert.ok(owner, 'same-run continuation should keep its ownership row')
    assert.equal(owner!.userId, adminId)
  })

  it('POST /chat/answer moves ownership to a new continuation run', async () => {
    let adminId = await getUserId('admin@newapp.com')
    chatRateLimiter.reset(adminId)

    let runId = crypto.randomUUID()
    let contRunId = crypto.randomUUID()
    mockAgent = makeMockAgent({
      resumeStream: async () => createMockStreamOutput('weiter', contRunId),
    })
    __setTestAgent(mockAgent)
    await recordChatRun({ runId, userId: adminId, threadId: 't' })

    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    let response = await router.fetch(CHAT_ANSWER_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, ...SSE_HEADERS },
      body: new URLSearchParams({ runId, answer: 'ja', selectionMode: 'single_select' }),
    })
    assert.equal(response.status, 200)
    let { text } = await parseSSEResponse(response)
    assert.equal(text, 'weiter')

    assert.equal(
      await findChatRunOwner(runId),
      null,
      'incoming run cleared when a new run continues',
    )
    let newOwner = await findChatRunOwner(contRunId)
    assert.ok(newOwner, 'continuation run should be recorded')
    assert.equal(newOwner!.userId, adminId)
  })

  // ── Rate limiting ───────────────────────────────────────

  it('POST /chat triggers rate limit after an allowed burst', async () => {
    let adminId = await getUserId('admin@newapp.com')
    chatRateLimiter.reset(adminId)

    mockAgent = makeMockAgent()
    __setTestAgent(mockAgent)

    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    // A normal multi-turn conversation must NOT be blocked (the old default of
    // maxAttempts=1 rejected the second message within the window). Allow an
    // explicit burst, then assert the limiter trips at the configured cap.
    let allowed = 10 // must match the controller's maxAttempts
    for (let i = 0; i < allowed; i++) {
      let res = await router.fetch(CHAT_ACTION_URL, {
        method: 'POST',
        headers: { Cookie: session.cookie, ...SSE_HEADERS },
        body: new URLSearchParams({ message: 'msg ' + i }),
      })
      assert.equal(res.status, 200, 'request ' + i + ' should be allowed')
    }

    let blocked = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, ...SSE_HEADERS },
      body: new URLSearchParams({ message: 'too fast' }),
    })

    assert.equal(blocked.status, 429)
    let { events } = await parseSSEResponse(blocked)
    assert.ok(
      events.find((e) => e.type === 'agent-error'),
      '429 should emit agent-error',
    )
  })
})
