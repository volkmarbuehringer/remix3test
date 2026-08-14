import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { EventBus, type EventHandler, type BaseEvent } from './event-bus.ts'
import { registerHandlers } from './register.ts'
import { validateHandler } from './handlers/validate.ts'
import { classifyHandler } from './handlers/classify.ts'
import { dispatchHandler } from './handlers/dispatch.ts'
import { confirmHandler } from './handlers/confirm.ts'
import { executeHandler, __setExecutors } from './handlers/execute.ts'
import { finalizeHandler } from './handlers/finalize.ts'
import { router } from '../../test-router.ts'
import { createAuthCookieWithCsrfForUser } from '../../test-utils.ts'
import { routes } from '../../routes.ts'

const BASE = 'https://remix.run'
const AGENT_EVENTS_URL = `${BASE}/admin/workflowagent2`
const AGENT_EVENTS_PANEL_URL = `${BASE}/admin/workflowagent2/panel`

const ADMIN_USER = { adminUserId: 1, adminEmail: 'admin@test.com' }

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

  it('full pipeline from request.received to request.completed via resume', async () => {
    await initializeAppDatabase()

    let bus = new EventBus()
    registerHandlers(bus)
    let emitted: string[] = []

    for await (let event of bus.run({
      type: 'request.received',
      message: 'cancel admin@newapp.com',
      ...ADMIN_USER,
    })) {
      emitted.push(event.type)
    }

    assert.ok(emitted.includes('confirm.required'))
    assert.ok(!emitted.includes('request.completed'))

    let bus2 = new EventBus()
    registerHandlers(bus2)
    let emitted2: string[] = []

    for await (let event of bus2.run({
      type: 'confirm.resolved',
      confirmed: true,
      payload: {
        intent: 'bogus',
        targetUserId: 42,
        ...ADMIN_USER,
      },
    })) {
      emitted2.push(event.type)
    }

    assert.ok(emitted2.includes('confirm.resolved'))
    assert.ok(emitted2.includes('action.completed'))
    assert.ok(emitted2.includes('request.completed'))
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
})

// ── Dispatch Handler ──────────────────────────────────────────

describe('dispatch handler', () => {
  it('cancel-user intent routes to action.running', async () => {
    let bus = new EventBus()
    bus.register(dispatchHandler)
    let running: unknown = null

    for await (let event of bus.run({
      type: 'entities.resolved',
      intent: 'cancel-user',
      params: { targetQuery: '42' },
      resolved: { targetUserId: 42 },
      ...ADMIN_USER,
    })) {
      if (event.type === 'action.running') {
        running = event.workflowId
      }
    }

    assert.equal(running, 'userManagementWorkflow')
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

// ── Confirm Handler ───────────────────────────────────────────

describe('confirm handler', () => {
  it('action.running emits confirm.required', async () => {
    let bus = new EventBus()
    bus.register(confirmHandler)
    let confirmed = false

    for await (let event of bus.run({
      type: 'action.running',
      workflowId: 'userManagementWorkflow',
      input: { action: 'cancel', targetUserId: 42 },
      summary: 'Cancel user 42',
    })) {
      if (event.type === 'confirm.required') {
        confirmed = true
        assert.ok(event.question)
        assert.equal(event.actionType, 'cancel')
      }
    }

    assert.ok(confirmed)
  })
})

// ── Execute Handler ───────────────────────────────────────────

describe('execute handler', () => {
  it('calls executor with correct arguments', async () => {
    let captured: unknown = null
    __setExecutors({
      cancel: async (input) => {
        captured = input
        return { success: true }
      },
    })

    let bus = new EventBus()
    bus.register(executeHandler)
    let completed: unknown = null

    for await (let event of bus.run({
      type: 'confirm.resolved',
      confirmed: true,
      payload: { intent: 'cancel', targetUserId: 42, ...ADMIN_USER },
    })) {
      if (event.type === 'action.completed') completed = event
    }

    assert.ok(completed)
    assert.ok((completed as any).success)
    assert.ok(captured)
    let input = captured as Record<string, unknown>
    assert.equal(input.targetUserId, 42)
    assert.equal(input.adminUserId, 1)
    assert.equal(input.adminEmail, 'admin@test.com')
  })

  it('confirmed resume with unknown intent emits action.completed error', async () => {
    let bus = new EventBus()
    bus.register(executeHandler)
    let completed: unknown = null

    for await (let event of bus.run({
      type: 'confirm.resolved',
      confirmed: true,
      payload: { intent: 'bogus', targetUserId: 42, ...ADMIN_USER },
    })) {
      if (event.type === 'action.completed') {
        completed = event
      }
    }

    assert.ok(completed)
    assert.equal((completed as any).success, false)
    assert.ok(String((completed as any).result.error || '').includes('Unknown action'))
  })

  it('cancelled resume emits action.completed with failure', async () => {
    let bus = new EventBus()
    bus.register(executeHandler)
    let completed: unknown = null
    let emitted: string[] = []

    for await (let event of bus.run({ type: 'confirm.resolved', confirmed: false })) {
      emitted.push(event.type)
      if (event.type === 'action.completed') {
        completed = event
      }
    }

    assert.ok(completed)
    assert.ok(!(completed as any).success)
    assert.equal((completed as any).result.error, 'Cancelled by admin')
  })

  it('missing targetUserId emits error', async () => {
    let bus = new EventBus()
    bus.register(executeHandler)
    let completed: unknown = null

    for await (let event of bus.run({
      type: 'confirm.resolved',
      confirmed: true,
      payload: { intent: 'lock', targetUserId: 0, ...ADMIN_USER },
    })) {
      if (event.type === 'action.completed') {
        completed = event
      }
    }

    assert.ok(completed)
    assert.ok(!(completed as any).success)
    assert.equal((completed as any).result.error, 'No target user specified')
  })
})

// ── Finalize Handler ──────────────────────────────────────────

describe('finalize handler', () => {
  it('action.completed emits request.completed', async () => {
    let bus = new EventBus()
    bus.register(finalizeHandler)
    let finalized = false

    for await (let event of bus.run({ type: 'action.completed', success: true, result: {} })) {
      if (event.type === 'request.completed') finalized = true
    }

    assert.ok(finalized)
  })
})

// ── Full Pipeline Integration ─────────────────────────────────

describe('full pipeline integration', () => {
  it('cancel-user flows from request.received to confirm.required', async () => {
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
    assert.ok(eventTypes.includes('action.running'))
    assert.ok(eventTypes.includes('confirm.required'))
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

  it('returns SSE for confirm-required intent without hanging', async () => {
    let response = await postForm(AGENT_EVENTS_URL, adminCookie, {
      message: 'cancel admin@newapp.com',
    })
    assert.equal(response.status, 200)
    let reader = response.body?.getReader()
    assert.ok(reader, 'should have readable body')
    let decoder = new TextDecoder()
    let buffer = ''
    let found = false
    let timer = setTimeout(() => reader!.cancel(), 500)
    try {
      while (true) {
        let { done, value } = await reader!.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        if (buffer.includes('confirm-required')) {
          found = true
          break
        }
      }
    } finally {
      clearTimeout(timer)
      reader!.cancel().catch(() => {})
    }
    assert.ok(found, 'confirm-required event should be emitted')
  })

  it('resume rejects missing runId with 400', async () => {
    let response = await postForm(AGENT_EVENTS_URL + '/resume', adminCookie, {
      confirmed: 'true',
    })
    assert.equal(response.status, 400)
  })
})

// Re-use the same helper as in app/db.ts pattern
import { initializeAppDatabase } from '../../db.ts'
