import { describe, it, before, afterEach, after } from 'remix/test'
import * as assert from 'remix/assert'

import { initializeAppDatabase } from '../../db.ts'
import { pool } from '../../data/test-pool.ts'
import { router } from '../../test-router.ts'
import { createAuthCookieWithCsrf, createAuthCookieWithCsrfForUser } from '../../test-utils.ts'
import { routes } from '../../routes.ts'
import {
  __setTestAgent,
  __setTestResumeResolver,
  __setTestThreadLookup,
  __setTestDurableChat,
  __setTestDurableAgent,
  chatRateLimiter,
} from './controller.tsx'
import { recordChatRun, findChatRunOwner } from './run-store.ts'
import { resolvePendingGate } from './gate-store.ts'
import type { AgentStreamOutput } from '../mastra/shared-agent.ts'
import type {
  DurableChatAgent,
  DurableResumeOptions,
  DurableStreamOptions,
} from '../../utils/agent-chat-durable.ts'

const BASE = 'https://remix.run'
const CHAT_INDEX_URL = `${BASE}${routes.chat.index.href()}`
const CHAT_ACTION_URL = `${BASE}${routes.chat.action.href()}`
const CHAT_APPROVE_URL = `${BASE}${routes.chat.approve.href()}`
const CHAT_DECLINE_URL = `${BASE}${routes.chat.decline.href()}`
const CHAT_ANSWER_URL = `${BASE}${routes.chat.answer.href()}`
const CHAT_RECONNECT_URL = `${BASE}${routes.chat.reconnect.href()}`

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

function createMockSuspensionOutput(opts: {
  runId?: string
  toolCallId?: string
  toolName?: string
  args?: Record<string, unknown>
}): AgentStreamOutput {
  let id = opts.runId || crypto.randomUUID()
  return {
    runId: id,
    fullStream: new ReadableStream({
      start(controller) {
        controller.enqueue({
          type: 'tool-call-approval',
          payload: {
            toolCallId: opts.toolCallId ?? 'tc-reapprove',
            toolName: opts.toolName ?? 'book',
            args: opts.args ?? {},
          },
        })
        controller.close()
      },
    }),
    getFullOutput: async () => ({ text: '', finishReason: 'suspended' }),
  }
}

/** Polls until the predicate holds, so fire-and-forget cleanup is observable. */
async function waitFor(predicate: () => Promise<boolean>, timeoutMs = 2000): Promise<void> {
  let start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) return
    await new Promise((r) => setTimeout(r, 10))
  }
  throw new Error('waitFor timed out')
}

type MockAgent = {
  generate: (message: string, opts?: Record<string, unknown>) => Promise<{ text: string }>
  stream: (message: string, opts?: Record<string, unknown>) => Promise<AgentStreamOutput>
  resumeStream: (data: unknown, opts?: Record<string, unknown>) => Promise<AgentStreamOutput>
  approveToolCallGenerate?: (opts: {
    runId: string
    toolCallId?: string
    abortSignal?: AbortSignal
  }) => Promise<{
    text: string
    finishReason: string
    runId: string
    fullStream?: unknown
  }>
  declineToolCallGenerate?: (opts: {
    runId: string
    toolCallId?: string
    abortSignal?: AbortSignal
  }) => Promise<{
    text: string
    finishReason: string
    runId: string
    fullStream?: unknown
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
  // Users this suite authenticates as, and therefore the only rows it owns.
  // Deleting the whole table here raced the parallel chat suites
  // (`gate-store.test.ts`, `run-store.test.ts`), which create their own users
  // and need their `chat_runs` row to survive: `resolvePendingGate()` joins it,
  // so a wipe between their insert and assertion nulls their suspended gate.
  let suiteUserIds: number[] = []

  before(async () => {
    await initializeAppDatabase()

    let adminResult = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    adminCookie = adminResult?.cookie ?? ''
    let userResult = await createAuthCookieWithCsrfForUser('user@newapp.com')
    userCookie = userResult?.cookie ?? ''
    suiteUserIds = (
      await Promise.all([getUserId('admin@newapp.com'), getUserId('user@newapp.com')])
    ).filter((id) => Number.isInteger(id))
  })

  afterEach(async () => {
    await pool.query('DELETE FROM chat_runs WHERE user_id = ANY($1::int[])', [suiteUserIds])
    await pool.query('DELETE FROM chat_pending_gates WHERE user_id = ANY($1::int[])', [
      suiteUserIds,
    ])
    __setTestAgent(undefined)
    __setTestResumeResolver(undefined)
    __setTestThreadLookup(undefined)
  })

  after(async () => {
    __setTestAgent(undefined)
    __setTestResumeResolver(undefined)
    __setTestThreadLookup(undefined)
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

  it('POST /chat links a request-linked abort signal to the agent run', async () => {
    let adminId = await getUserId('admin@newapp.com')
    chatRateLimiter.reset(adminId)

    let seen: AbortSignal | undefined
    mockAgent = makeMockAgent({
      stream: async (_message, opts) => {
        seen = opts?.abortSignal as AbortSignal | undefined
        return createMockStreamOutput('Ok')
      },
    })
    __setTestAgent(mockAgent)

    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    let response = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, ...SSE_HEADERS },
      body: new URLSearchParams({ message: 'Hallo' }),
    })
    await parseSSEResponse(response)

    assert.ok(seen instanceof AbortSignal, 'the agent run must receive an abort signal')
    assert.equal(seen!.aborted, false, 'a live run must not be pre-aborted')
  })

  it('POST /chat passes threadId and continues the same thread', async () => {
    let adminId = await getUserId('admin@newapp.com')
    chatRateLimiter.reset(adminId)

    mockAgent = makeMockAgent()
    __setTestAgent(mockAgent)

    let existingThreadId = crypto.randomUUID()
    __setTestThreadLookup(async (id) =>
      id === existingThreadId ? { resourceId: String(adminId) } : null,
    )
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

  it('POST /chat ignores a thread id the customer does not own', async () => {
    let adminId = await getUserId('admin@newapp.com')
    chatRateLimiter.reset(adminId)

    mockAgent = makeMockAgent()
    __setTestAgent(mockAgent)

    let foreignThreadId = crypto.randomUUID()
    // The thread exists, but its resource is not this customer's user id.
    __setTestThreadLookup(async () => ({ resourceId: String(adminId + 999) }))

    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    let response = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, ...SSE_HEADERS },
      body: new URLSearchParams({ message: 'hallo', threadId: foreignThreadId }),
    })

    assert.equal(response.status, 200)
    let { events } = await parseSSEResponse(response)
    let startEvent = events.find((e) => e.type === 'start')
    assert.ok(startEvent, 'should emit start')
    let emitted = (JSON.parse(startEvent!.data) as { threadId?: string }).threadId
    assert.ok(emitted, 'should emit a thread id')
    assert.ok(
      emitted !== foreignThreadId,
      'a thread the customer does not own must not be continued',
    )
  })

  it('POST /chat clears the run ownership row after a settled turn', async () => {
    let adminId = await getUserId('admin@newapp.com')
    chatRateLimiter.reset(adminId)

    mockAgent = makeMockAgent()
    __setTestAgent(mockAgent)

    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    let response = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, ...SSE_HEADERS },
      body: new URLSearchParams({ message: 'hallo' }),
    })
    let { events } = await parseSSEResponse(response)
    let startEvent = events.find((e) => e.type === 'start')
    assert.ok(startEvent, 'should emit start')
    let runId = (JSON.parse(startEvent!.data) as { runId: string }).runId

    await waitFor(async () => (await findChatRunOwner(runId)) === null)
    assert.equal(await findChatRunOwner(runId), null, 'settled run should be cleared')
  })

  it('POST /chat keeps the run ownership row when the run suspends', async () => {
    let adminId = await getUserId('admin@newapp.com')
    chatRateLimiter.reset(adminId)

    let runId = crypto.randomUUID()
    mockAgent = makeMockAgent({
      stream: async () => createMockSuspensionOutput({ runId }),
    })
    __setTestAgent(mockAgent)

    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    let response = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, ...SSE_HEADERS },
      body: new URLSearchParams({ message: 'storniere meinen Termin' }),
    })
    let { events } = await parseSSEResponse(response)
    assert.equal(response.status, 200)
    assert.ok(
      events.find((e) => e.type === 'suspension'),
      'should emit a suspension event',
    )

    let owner = await findChatRunOwner(runId)
    assert.ok(owner, 'a suspended run must keep its ownership row')
    assert.equal(owner!.userId, adminId)
  })

  it('POST /chat forwards a question event when the agent suspends on ask_user', async () => {
    let adminId = await getUserId('admin@newapp.com')
    chatRateLimiter.reset(adminId)

    let runId = crypto.randomUUID()
    mockAgent = makeMockAgent({
      stream: async () => ({
        runId,
        fullStream: new ReadableStream({
          start(controller) {
            controller.enqueue({
              type: 'tool-call-suspended',
              payload: {
                toolCallId: 'call-q',
                toolName: 'ask_user',
                suspendPayload: { question: 'Welcher Termin?', selectionMode: 'single_select' },
                args: { question: 'Welcher Termin?' },
              },
            })
            controller.close()
          },
        }),
        getFullOutput: async () => ({ text: '', finishReason: 'suspended' }),
      }),
    })
    __setTestAgent(mockAgent)

    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    let response = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, ...SSE_HEADERS },
      body: new URLSearchParams({ message: 'wann?' }),
    })
    assert.equal(response.status, 200)

    let { events } = await parseSSEResponse(response)
    let questionEvent = events.find((e) => e.type === 'question')
    assert.ok(questionEvent, 'should emit a question event')
    let payload = JSON.parse(questionEvent!.data) as { question?: string; runId?: string }
    assert.equal(payload.question, 'Welcher Termin?')
    assert.equal(payload.runId, runId)

    let owner = await findChatRunOwner(runId)
    assert.ok(owner, 'a suspended question run should keep its ownership row')
    assert.equal(owner!.userId, adminId)
  })

  it('GET /chat/reconnect re-surfaces a suspended ask_user question', async () => {
    let adminId = await getUserId('admin@newapp.com')
    chatRateLimiter.reset(adminId)

    let runId = crypto.randomUUID()
    mockAgent = makeMockAgent({
      stream: async () => ({
        runId,
        fullStream: new ReadableStream({
          start(controller) {
            controller.enqueue({
              type: 'tool-call-suspended',
              payload: {
                toolCallId: 'call-q',
                toolName: 'ask_user',
                suspendPayload: { question: 'Welcher Termin?', selectionMode: 'single_select' },
                args: { question: 'Welcher Termin?' },
              },
            })
            controller.close()
          },
        }),
        getFullOutput: async () => ({ text: '', finishReason: 'suspended' }),
      }),
    })
    __setTestAgent(mockAgent)

    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    let response = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, ...SSE_HEADERS },
      body: new URLSearchParams({ message: 'wann?' }),
    })
    await parseSSEResponse(response)

    // The gate write is fire-and-forget off the stream, so wait for it.
    await waitFor(async () => (await resolvePendingGate(adminId)) !== null)

    let reconnect = await router.fetch(CHAT_RECONNECT_URL, {
      headers: { Cookie: session.cookie },
    })
    assert.equal(reconnect.status, 200)
    let body = (await reconnect.json()) as {
      status?: string
      runId?: string
      gateType?: string
      toolCallId?: string
      suspendPayload?: { question?: string }
    }
    assert.equal(body.status, 'suspended')
    assert.equal(body.runId, runId)
    assert.equal(body.gateType, 'question')
    assert.equal(body.toolCallId, 'call-q')
    assert.equal(body.suspendPayload?.question, 'Welcher Termin?')
  })

  it('GET /chat/reconnect returns none when nothing is pending', async () => {
    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    let response = await router.fetch(CHAT_RECONNECT_URL, {
      headers: { Cookie: session.cookie },
    })
    assert.equal(response.status, 200)
    let body = (await response.json()) as { status?: string }
    assert.equal(body.status, 'none')
  })

  it('POST /chat forwards tool lifecycle and reasoning events', async () => {
    let adminId = await getUserId('admin@newapp.com')
    chatRateLimiter.reset(adminId)

    let runId = crypto.randomUUID()
    mockAgent = makeMockAgent({
      stream: async () => ({
        runId,
        fullStream: new ReadableStream({
          start(controller) {
            controller.enqueue({
              type: 'tool-call-input-streaming-start',
              payload: { toolCallId: 'c1', toolName: 'find_next_available_slots' },
            })
            controller.enqueue({
              type: 'tool-call-delta',
              payload: { toolCallId: 'c1', argsTextDelta: '{"resourceId":' },
            })
            controller.enqueue({
              type: 'tool-call',
              payload: { toolCallId: 'c1', args: { resourceId: 3 } },
            })
            controller.enqueue({
              type: 'tool-result',
              payload: { toolCallId: 'c1', result: { slots: [] }, isError: false },
            })
            controller.enqueue({ type: 'step-finish', payload: {} })
            controller.enqueue({ type: 'reasoning-start', payload: { id: 'r1' } })
            controller.enqueue({ type: 'reasoning-delta', payload: { text: 'denke' } })
            controller.enqueue({ type: 'reasoning-end', payload: {} })
            controller.enqueue({ type: 'finish', payload: {} })
            controller.close()
          },
        }),
        getFullOutput: async () => ({ text: '', finishReason: 'stop' }),
      }),
    })
    __setTestAgent(mockAgent)

    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    let response = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, ...SSE_HEADERS },
      body: new URLSearchParams({ message: 'hallo' }),
    })
    let { events } = await parseSSEResponse(response)
    assert.equal(response.status, 200)

    let types = events.map((e) => e.type)
    for (let expected of [
      'tool-call-input-streaming-start',
      'tool-call-delta',
      'tool-call',
      'tool-result',
      'step-finish',
      'reasoning-start',
      'reasoning-delta',
      'reasoning-end',
      'complete',
    ]) {
      assert.ok(types.includes(expected), `should forward ${expected}`)
    }
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

  it('POST /chat/approve links an abort signal to the agent run', async () => {
    let adminId = await getUserId('admin@newapp.com')
    chatRateLimiter.reset(adminId)

    let seen: AbortSignal | undefined
    mockAgent = makeMockAgent({
      approveToolCallGenerate: async (opts) => {
        seen = opts.abortSignal
        return { text: 'Bestätigt.', finishReason: 'stop', runId: crypto.randomUUID() }
      },
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
    await parseSSEResponse(response)

    assert.ok(seen instanceof AbortSignal, 'approve must pass the run abort signal')
    assert.equal(seen!.aborted, false, 'a live run must not be pre-aborted')
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

  it('POST /chat/approve keeps ownership when the continuation stream re-suspends', async () => {
    let adminId = await getUserId('admin@newapp.com')
    chatRateLimiter.reset(adminId)

    let contRunId = crypto.randomUUID()
    mockAgent = makeMockAgent({
      approveToolCallGenerate: async () => ({
        text: '',
        finishReason: 'stop',
        runId: contRunId,
        fullStream: createMockSuspensionOutput({ runId: contRunId }).fullStream,
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

    let { events } = await parseSSEResponse(response)
    assert.equal(response.status, 200)
    assert.ok(
      events.find((e) => e.type === 'suspension'),
      'should emit a suspension event',
    )

    // The continuation stream re-suspended: its ownership row must survive, or
    // the follow-up decision on contRunId would be a false 403.
    let owner = await findChatRunOwner(contRunId)
    assert.ok(owner, 're-suspended continuation should keep its ownership row')
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

  it('POST /chat/answer links an abort signal to the agent run', async () => {
    let adminId = await getUserId('admin@newapp.com')
    chatRateLimiter.reset(adminId)

    let seen: AbortSignal | undefined
    mockAgent = makeMockAgent({
      resumeStream: async (_data, opts) => {
        seen = opts?.abortSignal as AbortSignal | undefined
        return createMockStreamOutput('Fortsetzung.')
      },
    })
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
    await parseSSEResponse(response)

    assert.ok(seen instanceof AbortSignal, 'answer must pass the run abort signal')
    assert.equal(seen!.aborted, false, 'a live run must not be pre-aborted')
  })

  it('POST /chat/answer preserves ownership when the same run re-suspends', async () => {
    let adminId = await getUserId('admin@newapp.com')
    chatRateLimiter.reset(adminId)

    let runId = crypto.randomUUID()
    mockAgent = makeMockAgent({
      resumeStream: async () => createMockSuspensionOutput({ runId }),
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
    let { events } = await parseSSEResponse(response)
    assert.equal(response.status, 200)
    assert.ok(
      events.find((e) => e.type === 'suspension'),
      'should emit a suspension event',
    )

    // The same run re-suspended, so its ownership row must remain, or the
    // follow-up answer would be rejected (403).
    let owner = await findChatRunOwner(runId)
    assert.ok(owner, 'same-run continuation should keep its ownership row')
    assert.equal(owner!.userId, adminId)
  })

  it('POST /chat/answer moves ownership to a new re-suspended continuation run', async () => {
    let adminId = await getUserId('admin@newapp.com')
    chatRateLimiter.reset(adminId)

    let runId = crypto.randomUUID()
    let contRunId = crypto.randomUUID()
    mockAgent = makeMockAgent({
      resumeStream: async () => createMockSuspensionOutput({ runId: contRunId }),
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
    let { events } = await parseSSEResponse(response)
    assert.equal(response.status, 200)
    assert.ok(
      events.find((e) => e.type === 'suspension'),
      'should emit a suspension event',
    )

    assert.equal(
      await findChatRunOwner(runId),
      null,
      'incoming run cleared when a new run re-suspends',
    )
    let newOwner = await findChatRunOwner(contRunId)
    assert.ok(newOwner, 're-suspended continuation run should be recorded')
    assert.equal(newOwner!.userId, adminId)
  })

  it('POST /chat/answer clears ownership after a settled continuation', async () => {
    let adminId = await getUserId('admin@newapp.com')
    chatRateLimiter.reset(adminId)

    let runId = crypto.randomUUID()
    mockAgent = makeMockAgent({
      resumeStream: async () => createMockStreamOutput('fertig', runId),
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
    assert.equal(text, 'fertig')

    await waitFor(async () => (await findChatRunOwner(runId)) === null)
    assert.equal(await findChatRunOwner(runId), null, 'settled run should be cleared')
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

// ─────────────────────────────────────────────────────────────
// Durable-agent path (feature-flagged; Mastra createDurableAgent)
// ─────────────────────────────────────────────────────────────

function emptyDurableStream(): ReadableStream {
  return new ReadableStream({
    start(controller) {
      controller.close()
    },
  })
}

function durableTextStream(text: string): ReadableStream {
  return new ReadableStream({
    start(controller) {
      if (text) controller.enqueue({ type: 'text-delta', payload: { text } })
      controller.enqueue({ type: 'finish', payload: {} })
      controller.close()
    },
  })
}

function durableSuspensionStream(opts: {
  kind: 'approval' | 'question'
  toolCallId: string
  toolName: string
  args?: Record<string, unknown>
  question?: string
}): ReadableStream {
  return new ReadableStream({
    start(controller) {
      if (opts.kind === 'approval') {
        controller.enqueue({
          type: 'tool-call-approval',
          payload: { toolCallId: opts.toolCallId, toolName: opts.toolName, args: opts.args ?? {} },
        })
      } else {
        controller.enqueue({
          type: 'tool-call-suspended',
          payload: {
            toolCallId: opts.toolCallId,
            toolName: opts.toolName,
            args: opts.args ?? {},
            suspendPayload: {
              question: opts.question ?? 'Welcher Termin?',
              options: null,
              selectionMode: 'single_select',
            },
          },
        })
      }
      controller.close()
    },
  })
}

function makeDurableMockAgent(overrides?: Partial<DurableChatAgent>): DurableChatAgent {
  return {
    stream: async () => ({
      runId: crypto.randomUUID(),
      output: { fullStream: durableTextStream('Durable Antwort.') },
      cleanup: () => {},
    }),
    resume: async (_runId, _data) => ({
      runId: crypto.randomUUID(),
      output: { fullStream: durableTextStream('Fortsetzung.') },
      cleanup: () => {},
    }),
    observe: async () => ({
      output: { fullStream: emptyDurableStream() },
      detach: () => {},
    }),
    listSuspendedRuns: async () => ({ runs: [], total: 0 }),
    ...overrides,
  }
}

describe('Customer Chat controller — durable path', () => {
  let adminId: number
  let otherUserId: number
  let suiteUserIds: number[] = []

  before(async () => {
    await initializeAppDatabase()
    adminId = await getUserId('admin@newapp.com')
    otherUserId = await getUserId('user@newapp.com')
    suiteUserIds = [adminId, otherUserId].filter((id) => Number.isInteger(id))
  })

  afterEach(async () => {
    await pool.query('DELETE FROM chat_runs WHERE user_id = ANY($1::int[])', [suiteUserIds])
    await pool.query('DELETE FROM chat_pending_gates WHERE user_id = ANY($1::int[])', [
      suiteUserIds,
    ])
    __setTestDurableChat(undefined)
    __setTestDurableAgent(undefined)
    __setTestAgent(undefined)
  })

  after(async () => {
    __setTestDurableChat(undefined)
    __setTestDurableAgent(undefined)
  })

  it('streams a durable turn and clears ownership + cleanup on settle', async () => {
    chatRateLimiter.reset(adminId)
    let cleaned = false
    let seenOpts: DurableStreamOptions | undefined
    let runId = crypto.randomUUID()
    __setTestDurableChat(true)
    __setTestDurableAgent(
      makeDurableMockAgent({
        stream: async (_message, opts) => {
          seenOpts = opts
          return {
            runId,
            output: { fullStream: durableTextStream('Durable Antwort.') },
            cleanup: () => {
              cleaned = true
            },
          }
        },
      }),
    )

    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')
    let response = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, ...SSE_HEADERS },
      body: new URLSearchParams({ message: 'hallo' }),
    })
    let { events, text } = await parseSSEResponse(response)
    assert.equal(response.status, 200)
    assert.equal(events[0]?.type, 'start')
    assert.equal(text, 'Durable Antwort.')
    assert.ok(
      events.find((e) => e.type === 'complete'),
      'should complete',
    )

    await waitFor(async () => (await findChatRunOwner(runId)) === null)
    assert.equal(cleaned, true, 'cleanup must run from the starting process on settle')
    // Parity: no call-site requireToolApproval (true would gate every tool).
    assert.equal(seenOpts?.requireToolApproval, undefined)
    // Actor identity travels in RequestContext, not AsyncLocalStorage.
    assert.equal(seenOpts?.requestContext?.getRaw('actorId'), adminId)
  })

  it('keeps ownership and skips cleanup when the durable run suspends on approval', async () => {
    chatRateLimiter.reset(adminId)
    let cleaned = false
    let runId = crypto.randomUUID()
    __setTestDurableChat(true)
    __setTestDurableAgent(
      makeDurableMockAgent({
        stream: async () => ({
          runId,
          output: {
            fullStream: durableSuspensionStream({
              kind: 'approval',
              toolCallId: 'tc-1',
              toolName: 'cancel_booking',
              args: { appointmentId: 1 },
            }),
          },
          cleanup: () => {
            cleaned = true
          },
        }),
      }),
    )

    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')
    let response = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, ...SSE_HEADERS },
      body: new URLSearchParams({ message: 'storniere' }),
    })
    let { events } = await parseSSEResponse(response)
    let suspension = events.find((e) => e.type === 'suspension')
    assert.ok(suspension, 'should emit suspension')
    assert.equal((JSON.parse(suspension!.data) as { toolCallId?: string }).toolCallId, 'tc-1')

    let owner = await findChatRunOwner(runId)
    assert.ok(owner, 'a suspended durable run keeps its ownership row')
    assert.equal(owner!.userId, adminId)
    assert.equal(cleaned, false, 'a suspended run must not be cleaned up')
  })

  it('forwards a durable ask_user suspension as a question event', async () => {
    chatRateLimiter.reset(adminId)
    let runId = crypto.randomUUID()
    __setTestDurableChat(true)
    __setTestDurableAgent(
      makeDurableMockAgent({
        stream: async () => ({
          runId,
          output: {
            fullStream: durableSuspensionStream({
              kind: 'question',
              toolCallId: 'call-q',
              toolName: 'ask_user',
              question: 'Welcher Termin?',
            }),
          },
          cleanup: () => {},
        }),
      }),
    )

    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')
    let response = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, ...SSE_HEADERS },
      body: new URLSearchParams({ message: 'wann?' }),
    })
    let { events } = await parseSSEResponse(response)
    let question = events.find((e) => e.type === 'question')
    assert.ok(question, 'should emit question')
    let payload = JSON.parse(question!.data) as { question?: string; runId?: string }
    assert.equal(payload.question, 'Welcher Termin?')
    assert.equal(payload.runId, runId)
  })

  it('resumes a suspended approval through durable resume({ approved: true })', async () => {
    chatRateLimiter.reset(adminId)
    let resumeArgs:
      | { runId: string; data: unknown; opts: DurableResumeOptions | undefined }
      | undefined
    let cleaned = false
    let runId = crypto.randomUUID()
    __setTestDurableChat(true)
    __setTestDurableAgent(
      makeDurableMockAgent({
        resume: async (rid, data, opts) => {
          resumeArgs = { runId: rid, data, opts }
          return {
            runId: rid,
            output: { fullStream: durableTextStream('Bestätigt durable.') },
            cleanup: () => {
              cleaned = true
            },
          }
        },
      }),
    )
    await recordChatRun({ runId, userId: adminId, threadId: 't' })

    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')
    let response = await router.fetch(CHAT_APPROVE_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, ...SSE_HEADERS },
      body: new URLSearchParams({ runId, toolCallId: 'tc' }),
    })
    let { text } = await parseSSEResponse(response)
    assert.equal(text, 'Bestätigt durable.')
    assert.deepEqual(resumeArgs?.data, { approved: true })
    assert.equal(resumeArgs?.opts?.toolCallId, 'tc')

    await waitFor(async () => (await findChatRunOwner(runId)) === null)
    assert.equal(cleaned, true)
  })

  it('declines with durable resume({ approved: false })', async () => {
    chatRateLimiter.reset(adminId)
    let seenData: unknown
    let runId = crypto.randomUUID()
    __setTestDurableChat(true)
    __setTestDurableAgent(
      makeDurableMockAgent({
        resume: async (_rid, data) => {
          seenData = data
          return {
            runId,
            output: { fullStream: durableTextStream('Abgelehnt durable.') },
            cleanup: () => {},
          }
        },
      }),
    )
    await recordChatRun({ runId, userId: adminId, threadId: 't' })

    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')
    let response = await router.fetch(CHAT_DECLINE_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, ...SSE_HEADERS },
      body: new URLSearchParams({ runId, toolCallId: 'tc' }),
    })
    let { text } = await parseSSEResponse(response)
    assert.equal(text, 'Abgelehnt durable.')
    assert.deepEqual(seenData, { approved: false })
  })

  it('answers an ask_user question through durable resume with the answer data', async () => {
    chatRateLimiter.reset(adminId)
    let resumeArgs:
      | { runId: string; data: unknown; opts: DurableResumeOptions | undefined }
      | undefined
    let runId = crypto.randomUUID()
    __setTestDurableChat(true)
    __setTestDurableAgent(
      makeDurableMockAgent({
        resume: async (rid, data, opts) => {
          resumeArgs = { runId: rid, data, opts }
          return {
            runId: rid,
            output: { fullStream: durableTextStream('Antwort verarbeitet.') },
            cleanup: () => {},
          }
        },
      }),
    )
    await recordChatRun({ runId, userId: adminId, threadId: 't' })

    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')
    let response = await router.fetch(CHAT_ANSWER_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, ...SSE_HEADERS },
      body: new URLSearchParams({
        runId,
        answer: 'ja',
        selectionMode: 'single_select',
        toolCallId: 'tc',
      }),
    })
    let { text } = await parseSSEResponse(response)
    assert.equal(text, 'Antwort verarbeitet.')
    assert.equal(resumeArgs?.data, 'ja')
    assert.equal(resumeArgs?.opts?.toolCallId, 'tc')
  })

  it('re-attaches with observe(runId) and detaches on reconnect', async () => {
    chatRateLimiter.reset(adminId)
    let detached = false
    let observedRunId: string | undefined
    let runId = crypto.randomUUID()
    __setTestDurableChat(true)
    __setTestDurableAgent(
      makeDurableMockAgent({
        listSuspendedRuns: async () => ({
          runs: [
            {
              runId,
              threadId: 't',
              toolCalls: [
                {
                  toolCallId: 'call-q',
                  toolName: 'ask_user',
                  args: { question: 'Welcher Termin?' },
                  requiresApproval: false,
                  suspendPayload: {
                    question: 'Welcher Termin?',
                    options: null,
                    selectionMode: 'single_select',
                  },
                },
              ],
            },
          ],
          total: 1,
        }),
        observe: async (rid, opts) => {
          observedRunId = rid
          void opts?.onSuspended?.({
            toolCallId: 'call-q',
            toolName: 'ask_user',
            suspendPayload: {
              question: 'Welcher Termin?',
              options: null,
              selectionMode: 'single_select',
            },
            type: 'suspension',
          })
          return {
            output: { fullStream: emptyDurableStream() },
            detach: () => {
              detached = true
            },
          }
        },
      }),
    )
    await recordChatRun({ runId, userId: adminId, threadId: 't' })

    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')
    let response = await router.fetch(CHAT_RECONNECT_URL, {
      headers: { Cookie: session.cookie },
    })
    assert.equal(response.status, 200)
    let body = (await response.json()) as {
      status?: string
      runId?: string
      gateType?: string
      suspendPayload?: { question?: string }
    }
    assert.equal(body.status, 'suspended')
    assert.equal(body.runId, runId)
    assert.equal(body.gateType, 'question')
    assert.equal(body.suspendPayload?.question, 'Welcher Termin?')
    assert.equal(observedRunId, runId)
    assert.equal(detached, true, 'reconnect must detach the observer')
  })

  it('reconnect falls back to durable storage when the event cache is cold', async () => {
    chatRateLimiter.reset(adminId)
    let runId = crypto.randomUUID()
    __setTestDurableChat(true)
    __setTestDurableAgent(
      makeDurableMockAgent({
        listSuspendedRuns: async () => ({
          runs: [
            {
              runId,
              threadId: 't',
              toolCalls: [
                {
                  toolCallId: 'tc-9',
                  toolName: 'cancel_booking',
                  args: { appointmentId: 7 },
                  requiresApproval: true,
                },
              ],
            },
          ],
          total: 1,
        }),
        observe: async () => ({
          output: { fullStream: emptyDurableStream() },
          detach: () => {},
        }),
      }),
    )
    await recordChatRun({ runId, userId: adminId, threadId: 't' })

    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')
    let response = await router.fetch(CHAT_RECONNECT_URL, {
      headers: { Cookie: session.cookie },
    })
    let body = (await response.json()) as {
      status?: string
      gateType?: string
      toolCallId?: string
      args?: { appointmentId?: number }
    }
    assert.equal(body.status, 'suspended')
    assert.equal(body.gateType, 'tool_decision')
    assert.equal(body.toolCallId, 'tc-9')
    assert.equal(body.args?.appointmentId, 7)
  })

  it('rejects a durable decision on a run owned by another user with 403', async () => {
    chatRateLimiter.reset(adminId)
    let resumeCalled = false
    let runId = crypto.randomUUID()
    __setTestDurableChat(true)
    __setTestDurableAgent(
      makeDurableMockAgent({
        resume: async (rid) => {
          resumeCalled = true
          return {
            runId: rid,
            output: { fullStream: durableTextStream('sollte nicht passieren') },
            cleanup: () => {},
          }
        },
      }),
    )
    // The run belongs to a different customer.
    await recordChatRun({ runId, userId: otherUserId, threadId: 't' })

    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')
    let response = await router.fetch(CHAT_APPROVE_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, ...SSE_HEADERS },
      body: new URLSearchParams({ runId, toolCallId: 'tc' }),
    })
    assert.equal(response.status, 403)
    assert.equal(resumeCalled, false, 'a foreign run must not be resumed')
  })

  it('rejects a durable decision with no runId before touching the agent', async () => {
    chatRateLimiter.reset(adminId)
    __setTestDurableChat(true)
    __setTestDurableAgent(makeDurableMockAgent())

    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')
    let response = await router.fetch(CHAT_APPROVE_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, ...SSE_HEADERS },
      body: new URLSearchParams({}),
    })
    assert.equal(response.status, 400)
    let { events } = await parseSSEResponse(response)
    assert.ok(events.find((e) => e.type === 'agent-error'))
  })
})
