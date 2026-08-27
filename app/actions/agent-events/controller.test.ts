import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { EventBus, type EventHandler, type BaseEvent } from './event-bus.ts'
import { registerHandlers } from './register.ts'
import { validateHandler } from './handlers/validate.ts'
import { classifyHandler, __setAgent } from './handlers/classify.ts'
import { classifyWithAgent } from '../mastra/intent-classifier.ts'
import { dispatchHandler } from './handlers/dispatch.ts'
import { __setRunFactory } from './controller.tsx'
import { router } from '../../test-router.ts'
import { createAuthCookieWithCsrfForUser } from '../../test-utils.ts'
import { routes } from '../../routes.ts'

const BASE = 'https://remix.run'
const AGENT_EVENTS_URL = `${BASE}/admin/agent-events`
const AGENT_EVENTS_PANEL_URL = `${BASE}/admin/agent-events/panel`

const ADMIN_USER = { adminUserId: 1, adminEmail: 'admin@test.com' }

/** Builds an AsyncIterable from plain chunks for use as a fake workflow stream. */
function streamOf(...chunks: unknown[]): AsyncIterable<unknown> {
  return (async function* () {
    for (let c of chunks) yield c
  })()
}

// ── Fake classify agent ──────────────────────────────────────
// Emulates what the real workflowAgent LLM returns for the fixed
// test messages. Explicit per-message table — deterministic and
// drift-free, rather than re-deriving intent from keywords.

const FAKE_CLASSIFY_TABLE: Record<string, string> = {
  'cancel user 42': '{"type":"user-action","action":"cancel","targetQuery":"42"}',
  'lock user 5': '{"type":"user-action","action":"lock","targetQuery":"5"}',
  'show appointments for admin@test.com':
    '{"type":"appointment","action":"check","targetQuery":"admin@test.com"}',
  'ich will john doe sperren':
    '{"type":"user-action","action":"lock","targetQuery":"john doe"}',
  'ich will max mustermann kündigen':
    '{"type":"user-action","action":"cancel","targetQuery":"max mustermann"}',
  'i want to cancel john doe':
    '{"type":"user-action","action":"cancel","targetQuery":"john doe"}',
  'sperre benutzer jane@example.com':
    '{"type":"user-action","action":"lock","targetQuery":"jane@example.com"}',
  'cancel admin@newapp.com':
    '{"type":"user-action","action":"cancel","targetQuery":"admin@newapp.com"}',
}

const FAKE_CLASSIFY_AGENT = {
  async generate(message: string) {
    return { text: FAKE_CLASSIFY_TABLE[message.trim()] ?? 'Could you clarify what you want to do?' }
  },
}

__setAgent(FAKE_CLASSIFY_AGENT)

// ── Event Bus ────────────────────────────────────────────────

describe('EventBus', () => {
  it('emits initial event and handler output in order', async () => {
    let bus = new EventBus()
    let emitted: string[] = []

    bus.register(validateHandler)

    for await (let event of bus.run({
      type: 'request.received',
      message: 'cancel user 42',
      ...ADMIN_USER,
    })) {
      emitted.push(event.type)
    }

    assert.ok(emitted.includes('request.received'), 'initial event should be emitted')
    assert.ok(
      emitted.includes('request.validated') || emitted.includes('request.invalid'),
      'handler should emit',
    )
  })

  it('empty bus run emits only initial event', async () => {
    let bus = new EventBus()
    let emitted: string[] = []

    for await (let event of bus.run({
      type: 'request.received',
      message: 'hello',
      ...ADMIN_USER,
    })) {
      emitted.push(event.type)
    }

    assert.equal(emitted.length, 1)
    assert.equal(emitted[0], 'request.received')
  })

  it('multiple handlers process events sequentially', async () => {
    let bus = new EventBus()
    registerHandlers(bus)
    let emitted: string[] = []

    for await (let event of bus.run({
      type: 'request.received',
      message: 'show appointments for admin@test.com',
      ...ADMIN_USER,
    })) {
      emitted.push(event.type)
    }

    assert.ok(emitted.includes('request.received'))
    assert.ok(emitted.includes('request.validated'))
    assert.ok(emitted.includes('intent.classified'))
    assert.ok(emitted.includes('entities.resolved'))
    assert.ok(emitted.includes('navigate'))
    assert.ok(!emitted.includes('confirm.required'))
  })

})

// ── Validate Handler ──────────────────────────────────────────

describe('validate handler', () => {
  it('valid message emits request.validated', async () => {
    let bus = new EventBus()
    bus.register(validateHandler)
    let emitted: string[] = []

    for await (let event of bus.run({
      type: 'request.received',
      message: 'cancel user 42',
      ...ADMIN_USER,
    })) {
      emitted.push(event.type)
      if (event.type === 'request.validated') {
        assert.equal(event.message, 'cancel user 42')
      }
    }

    assert.ok(emitted.includes('request.validated'))
  })

  it('empty message emits request.invalid', async () => {
    let bus = new EventBus()
    bus.register(validateHandler)
    let emitted: string[] = []

    for await (let event of bus.run({
      type: 'request.received',
      message: '   ',
      ...ADMIN_USER,
    })) {
      emitted.push(event.type)
      if (event.type === 'request.invalid') {
        assert.ok(event.error.includes('required'))
      }
    }

    assert.ok(emitted.includes('request.invalid'))
  })
})

// ── Classify Handler ──────────────────────────────────────────

describe('classify handler', () => {
  it('cancel intent produces classified event', async () => {
    let bus = new EventBus()
    bus.register(classifyHandler)
    let result: unknown = null

    for await (let event of bus.run({
      type: 'request.validated',
      message: 'cancel user 42',
      ...ADMIN_USER,
    })) {
      if (event.type === 'intent.classified') {
        result = event.intent
      }
    }

    assert.equal(result, 'cancel-user')
  })

  it('lock intent produces classified event', async () => {
    let bus = new EventBus()
    bus.register(classifyHandler)
    let result: unknown = null

    for await (let event of bus.run({
      type: 'request.validated',
      message: 'lock user 5',
      ...ADMIN_USER,
    })) {
      if (event.type === 'intent.classified') {
        result = event.intent
      }
    }

    assert.equal(result, 'lock-user')
  })

  it('unclear intent emits intent.unclear', async () => {
    let bus = new EventBus()
    bus.register(classifyHandler)
    let unclear = false

    for await (let event of bus.run({
      type: 'request.validated',
      message: 'xyzzy',
      ...ADMIN_USER,
    })) {
      if (event.type === 'intent.unclear') {
        unclear = true
      }
    }

    assert.ok(unclear)
  })

  it('show appointments intent emits show-appointments', async () => {
    let bus = new EventBus()
    bus.register(classifyHandler)
    let result: unknown = null

    for await (let event of bus.run({
      type: 'request.validated',
      message: 'show appointments for admin@test.com',
      ...ADMIN_USER,
    })) {
      if (event.type === 'intent.classified') {
        result = event.intent
      }
    }

    assert.equal(result, 'show-appointments')
  })

  it('extracts the target from German verb-final sentences', async () => {
    let bus = new EventBus()
    bus.register(classifyHandler)
    let targetQuery: unknown = null

    for await (let event of bus.run({
      type: 'request.validated',
      message: 'ich will john doe sperren',
      ...ADMIN_USER,
    })) {
      if (event.type === 'intent.classified') {
        targetQuery = event.params.targetQuery
      }
    }

    assert.equal(targetQuery, 'john doe')
  })

  it('extracts kündigen target from German verb-final sentences', async () => {
    let bus = new EventBus()
    bus.register(classifyHandler)
    let targetQuery: unknown = null

    for await (let event of bus.run({
      type: 'request.validated',
      message: 'ich will max mustermann kündigen',
      ...ADMIN_USER,
    })) {
      if (event.type === 'intent.classified') {
        targetQuery = event.params.targetQuery
      }
    }

    assert.equal(targetQuery, 'max mustermann')
  })

  it('keeps English target extraction intact', async () => {
    let bus = new EventBus()
    bus.register(classifyHandler)
    let targetQuery: unknown = null

    for await (let event of bus.run({
      type: 'request.validated',
      message: 'i want to cancel john doe',
      ...ADMIN_USER,
    })) {
      if (event.type === 'intent.classified') {
        targetQuery = event.params.targetQuery
      }
    }

    assert.equal(targetQuery, 'john doe')
  })

  it('extracts numeric IDs and emails as-is', async () => {
    let bus = new EventBus()
    bus.register(classifyHandler)

    let idResult: unknown = null
    for await (let event of bus.run({
      type: 'request.validated',
      message: 'cancel user 42',
      ...ADMIN_USER,
    })) {
      if (event.type === 'intent.classified') idResult = event.params.targetQuery
    }
    assert.equal(idResult, '42')

    let emailResult: unknown = null
    for await (let event of bus.run({
      type: 'request.validated',
      message: 'sperre benutzer jane@example.com',
      ...ADMIN_USER,
    })) {
      if (event.type === 'intent.classified') emailResult = event.params.targetQuery
    }
    assert.equal(emailResult, 'jane@example.com')
  })

  it('maps German intent keywords to lock/cancel intents', async () => {
    let bus = new EventBus()
    bus.register(classifyHandler)

    let lockIntent: unknown = null
    for await (let event of bus.run({
      type: 'request.validated',
      message: 'ich will john doe sperren',
      ...ADMIN_USER,
    })) {
      if (event.type === 'intent.classified') lockIntent = event.intent
    }
    assert.equal(lockIntent, 'lock-user')

    let cancelIntent: unknown = null
    for await (let event of bus.run({
      type: 'request.validated',
      message: 'ich will max mustermann kündigen',
      ...ADMIN_USER,
    })) {
      if (event.type === 'intent.classified') cancelIntent = event.intent
    }
    assert.equal(cancelIntent, 'cancel-user')
  })

  it('emits intent.unclear when the agent rejects after abort', async () => {
    let result = await classifyWithAgent(
      {
        async generate(message, opts) {
          return new Promise((_resolve, reject) => {
            if (opts?.abortSignal) {
              opts.abortSignal.addEventListener('abort', () => reject(new Error('aborted')))
            }
          })
        },
      },
      'cancel user 42',
      { timeoutMs: 20 },
    )
    assert.ok('unclear' in result)
  })

  it('coerces numeric targetQuery from the agent to a string', async () => {
    let result = await classifyWithAgent(
      {
        async generate() {
          return { text: '{"type":"user-action","action":"cancel","targetQuery":42}' }
        },
      },
      'cancel user 42',
    )
    assert.ok('intent' in result)
    assert.equal(result.intent, 'cancel-user')
    assert.equal(result.targetQuery, '42')
  })

  it('emits unclear for actionable intent without a target', async () => {
    let result = await classifyWithAgent(
      {
        async generate() {
          return { text: '{"type":"user-action","action":"lock"}' }
        },
      },
      'lock someone',
    )
    assert.ok('unclear' in result)
  })

  it('allows empty target for appointment check', async () => {
    let result = await classifyWithAgent(
      {
        async generate() {
          return { text: '{"type":"appointment","action":"check"}' }
        },
      },
      'show all appointments',
    )
    assert.ok('intent' in result)
    assert.equal(result.intent, 'show-appointments')
    assert.equal(result.targetQuery, '')
  })

  it('emits unclear for unmapped agent actions (lookup)', async () => {
    let result = await classifyWithAgent(
      {
        async generate() {
          return { text: '{"type":"user-action","action":"lookup","targetQuery":"42"}' }
        },
      },
      'find user 42',
    )
    assert.ok('unclear' in result)
  })

  it('handler emits intent.unclear when the agent throws', async () => {
    __setAgent({
      async generate() {
        throw new Error('agent unavailable')
      },
    })

    try {
      let bus = new EventBus()
      bus.register(classifyHandler)
      let unclear = false

      for await (let event of bus.run({
        type: 'request.validated',
        message: 'cancel user 42',
        ...ADMIN_USER,
      })) {
        if (event.type === 'intent.unclear') unclear = true
      }

      assert.ok(unclear)
    } finally {
      __setAgent(FAKE_CLASSIFY_AGENT)
    }
  })
})

// ── Dispatch Handler ──────────────────────────────────────────

describe('dispatch handler', () => {
  it('cancel-user intent routes to workflow.requested', async () => {
    let bus = new EventBus()
    bus.register(dispatchHandler)
    let requested: Record<string, unknown> | null = null

    for await (let event of bus.run({
      type: 'entities.resolved',
      intent: 'cancel-user',
      params: { targetQuery: '42' },
      resolved: { targetUserId: 42 },
      ...ADMIN_USER,
    })) {
      if (event.type === 'workflow.requested') {
        requested = event as Record<string, unknown>
      }
    }

    assert.ok(requested, 'should emit workflow.requested')
    assert.equal(requested!.workflowId, 'userManagementWorkflow')
    assert.equal((requested!.input as Record<string, unknown>).action, 'cancel')
    assert.equal((requested!.navigate as Record<string, unknown>).target, 'agent-events-panel')
  })

  it('dispatch handler directly emits navigate', async () => {
    let emitted: BaseEvent[] = []
    let emit = (e: BaseEvent) => void emitted.push(e)

    await (dispatchHandler as EventHandler).handle(
      {
        type: 'entities.resolved' as const,
        intent: 'show-appointments',
        params: { targetQuery: 'admin@test.com' },
        resolved: { targetEmail: 'admin@test.com' },
        ...ADMIN_USER,
      },
      emit,
    )

    assert.equal(
      emitted.length,
      1,
      `expected 1 event, got ${emitted.length}: ${JSON.stringify(emitted)}`,
    )
    if (emitted[0]?.type === 'navigate') {
      assert.ok(String(emitted[0].href).includes('admin%40test.com'))
    }
  })

  it('show-appointments intent routes to navigate via bus', async () => {
    let bus = new EventBus()
    bus.register(dispatchHandler as EventHandler)
    let navHref: unknown = null

    for await (let event of bus.run({
      type: 'entities.resolved',
      intent: 'show-appointments',
      params: { targetQuery: 'admin@test.com' },
      resolved: { targetEmail: 'admin@test.com' },
      ...ADMIN_USER,
    })) {
      if (event.type === 'navigate') {
        navHref = event.href
      }
    }

    assert.ok(navHref)
    assert.ok(String(navHref).includes('admin%40test.com'))
  })
})

// ── Finalize Handler ──────────────────────────────────────────

// ── Full Pipeline Integration ─────────────────────────────────

describe('full pipeline integration', () => {
  it('cancel-user flows from request.received to workflow.requested', async () => {
    await initializeAppDatabase()

    let bus = new EventBus()
    registerHandlers(bus)
    let eventTypes: string[] = []

    for await (let event of bus.run({
      type: 'request.received',
      message: 'cancel admin@newapp.com',
      ...ADMIN_USER,
    })) {
      eventTypes.push(event.type)
    }

    assert.ok(eventTypes.includes('request.received'))
    assert.ok(eventTypes.includes('request.validated'))
    assert.ok(eventTypes.includes('intent.classified'))
    assert.ok(eventTypes.includes('entities.resolved'))
    assert.ok(eventTypes.includes('workflow.requested'))
    assert.ok(!eventTypes.includes('confirm.required'))
    assert.ok(!eventTypes.includes('request.completed'))
  })

  it('show-appointments flows from request.received to navigate', async () => {
    let bus = new EventBus()
    registerHandlers(bus)
    let eventTypes: string[] = []

    for await (let event of bus.run({
      type: 'request.received',
      message: 'show appointments for admin@test.com',
      ...ADMIN_USER,
    })) {
      eventTypes.push(event.type)
    }

    assert.ok(eventTypes.includes('navigate'))
    assert.ok(!eventTypes.includes('confirm.required'))
  })
})

// ── Controller Tests ──────────────────────────────────────────

describe('AgentEvents route (GET)', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  it('returns 200 for authenticated admin user', async () => {
    let session = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    if (!session) throw new Error('Failed to create auth session')
    let response = await router.fetch(AGENT_EVENTS_URL, {
      headers: { Cookie: session.cookie },
    })
    assert.equal(response.status, 200)
  })

  it('renders the AgentEventsPage with form and frame', async () => {
    let session = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    if (!session) throw new Error('Failed to create auth session')
    let response = await router.fetch(AGENT_EVENTS_URL, {
      headers: { Cookie: session.cookie },
    })
    let text = await response.text()
    assert.ok(text.includes('agent-events-frame-container'), 'should have frame container')
    assert.ok(text.includes('agent-events-form'), 'should have form')
    assert.ok(text.includes('agent-events-input'), 'should have input')
    assert.ok(text.includes('</textarea>'), 'input should be a textarea')
    assert.ok(text.includes('ae-status-bar'), 'should have status bar')
  })

  it('panel returns placeholder content', async () => {
    let session = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    if (!session) throw new Error('Failed to create auth session')
    let response = await router.fetch(AGENT_EVENTS_PANEL_URL, {
      headers: { Cookie: session.cookie },
    })
    assert.equal(response.status, 200)
  })

  it('redirects to login for unauthenticated requests', async () => {
    let response = await router.fetch(AGENT_EVENTS_URL, { redirect: 'manual' })
    assert.equal(response.status, 302)
  })
})

describe('AgentEvents route (POST validation)', () => {
  let adminCookie: string

  before(async () => {
    await initializeAppDatabase()
    let session = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    if (!session) throw new Error('Failed to create auth session')
    adminCookie = session.cookie
  })

  function postForm(url: string, cookie: string, fields: Record<string, string>) {
    let body = new URLSearchParams(fields)
    return router.fetch(url, {
      method: 'POST',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Sse-Request': '1',
      },
      body: body.toString(),
    })
  }

  it('rejects an empty message with 400', async () => {
    let response = await postForm(AGENT_EVENTS_URL, adminCookie, { message: '   ' })
    assert.equal(response.status, 400)
  })

  it('rejects an oversized message with 400', async () => {
    let response = await postForm(AGENT_EVENTS_URL, adminCookie, {
      message: 'x'.repeat(5001),
    })
    assert.equal(response.status, 400)
  })

  it('returns SSE for a valid request that completes', async () => {
    let response = await postForm(AGENT_EVENTS_URL, adminCookie, {
      message: 'show appointments for admin@test.com',
    })
    assert.equal(response.status, 200)
    let text = await response.text()
    assert.ok(text.includes('event:'), 'should be SSE')
    assert.ok(text.includes('data:'), 'should have data')
  })

  it('resume rejects missing runId with 400', async () => {
    let response = await postForm(AGENT_EVENTS_URL + '/resume', adminCookie, {
      confirmed: 'true',
    })
    assert.equal(response.status, 400)
  })

  it('returns SSE for a cancel request that suspends at the confirm gate', async () => {
    __setRunFactory(async () => ({
      runId: 'run-suspend-1',
      fullStream: streamOf({
        type: 'workflow-step-suspended',
        payload: {
          id: 'confirm-gate',
          suspendPayload: {
            question: 'Cancel user?',
            actionType: 'cancel',
            targetUserName: 'Jane',
            pendingCount: 2,
          },
        },
      }),
    }))
    try {
      let response = await postForm(AGENT_EVENTS_URL, adminCookie, {
        message: 'cancel admin@newapp.com',
      })
      assert.equal(response.status, 200)
      let text = await response.text()
      assert.ok(text.includes('event: start'), 'should emit start')
      assert.ok(text.includes('run-suspend-1'), 'should carry the run id')
      assert.ok(text.includes('workflow-step-suspended'), 'should emit the suspended step')
      assert.ok(text.includes('Cancel user?'), 'should carry the suspend question')
    } finally {
      __setRunFactory(undefined)
    }
  })

  it('resume re-attaches to the run and completes after confirmation', async () => {
    let captured: { confirmed?: boolean } = {}
    __setRunFactory(async (_workflowId, opts) => {
      captured.confirmed = (opts.resumeData as { confirmed?: boolean })?.confirmed
      return {
        runId: 'run-resume-1',
        fullStream: streamOf({
          type: 'workflow-finish',
          payload: { workflowStatus: 'success', success: true },
        }),
      }
    })
    try {
      let response = await postForm(AGENT_EVENTS_URL + '/resume', adminCookie, {
        runId: 'run-resume-1',
        confirmed: 'true',
      })
      assert.equal(response.status, 200)
      assert.equal(captured.confirmed, true, 'resume should pass the confirmed flag')
      let text = await response.text()
      assert.ok(text.includes('event: start'), 'should emit start on resume')
      assert.ok(text.includes('workflow-finish'), 'should emit finish')
      assert.ok(text.includes('"success":true'), 'should report success')
    } finally {
      __setRunFactory(undefined)
    }
  })

  it('resume surfaces an error for an invalid run id', async () => {
    __setRunFactory(async () => {
      throw new Error('no such run')
    })
    try {
      let response = await postForm(AGENT_EVENTS_URL + '/resume', adminCookie, {
        runId: 'bogus',
        confirmed: 'true',
      })
      assert.equal(response.status, 200)
      let text = await response.text()
      assert.ok(text.includes('agent-error'), 'invalid run should emit agent-error')
    } finally {
      __setRunFactory(undefined)
    }
  })
})

// Re-use the same helper as in app/db.ts pattern
import { initializeAppDatabase } from '../../db.ts'
