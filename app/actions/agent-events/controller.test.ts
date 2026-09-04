import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { EventBus, type EventHandler, type BaseEvent } from './event-bus.ts'
import { registerHandlers } from './register.ts'
import { validateHandler } from './handlers/validate.ts'
import { classifyHandler, __setAgent } from './handlers/classify.ts'
import { classifyWithAgent } from '../mastra/intent-classifier.ts'
import { dispatchHandler } from './handlers/dispatch.ts'
import { __setRunFactory, __setRunStatusResolver } from './controller.tsx'
import {
  upsertActiveRun,
  markSuspended,
  findActiveRun,
  clearActiveRun,
  findRunOwner,
  findRunById,
} from './active-run-store.ts'
import { router } from '../../test-router.ts'
import { createAuthCookieWithCsrfForUser } from '../../test-utils.ts'
import { routes } from '../../routes.ts'

const BASE = 'https://remix.run'
const AGENT_EVENTS_URL = `${BASE}/admin/agent-events`
const AGENT_EVENTS_PANEL_URL = `${BASE}/admin/agent-events/panel`
const AGENT_EVENTS_RECONNECT_URL = `${BASE}/admin/agent-events/reconnect`

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
  'ich will john doe sperren': '{"type":"user-action","action":"lock","targetQuery":"john doe"}',
  'ich will max mustermann kündigen':
    '{"type":"user-action","action":"cancel","targetQuery":"max mustermann"}',
  'i want to cancel john doe': '{"type":"user-action","action":"cancel","targetQuery":"john doe"}',
  'sperre benutzer jane@example.com':
    '{"type":"user-action","action":"lock","targetQuery":"jane@example.com"}',
  'cancel admin@newapp.com':
    '{"type":"user-action","action":"cancel","targetQuery":"admin@newapp.com"}',
  'delete all appointments for user@newapp.com in raum 1':
    '{"type":"appointment","action":"delete-resource","targetQuery":"user@newapp.com","resourceQuery":"raum 1"}',
  'delete appointments for nobody@example.com in no-such-room':
    '{"type":"appointment","action":"delete-resource","targetQuery":"nobody@example.com","resourceQuery":"no-such-room"}',
  'cancel user 999999': '{"type":"user-action","action":"cancel","targetQuery":"999999"}',
  'find user admin@newapp.com':
    '{"type":"user-action","action":"lookup","targetQuery":"admin@newapp.com"}',
  'find user 999999': '{"type":"user-action","action":"lookup","targetQuery":"999999"}',
  'show appointments next month':
    '{"type":"appointment","action":"check","period":"next-month","status":"pending"}',
  'show pending appointments for admin@test.com next week':
    '{"type":"appointment","action":"check","targetQuery":"admin@test.com","period":"next-week","status":"pending"}',
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

  it('classify handler carries period and status in the classified event', async () => {
    let bus = new EventBus()
    bus.register(classifyHandler)
    let period: unknown = null
    let status: unknown = null

    for await (let event of bus.run({
      type: 'request.validated',
      message: 'show appointments next month',
      ...ADMIN_USER,
    })) {
      if (event.type === 'intent.classified') {
        period = event.params.period
        status = event.params.status
      }
    }

    assert.equal(period, 'next-month')
    assert.equal(status, 'pending')
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

  it('extracts period and status from an appointment check', async () => {
    let result = await classifyWithAgent(
      {
        async generate() {
          return {
            text: '{"type":"appointment","action":"check","period":"this-week","status":"pending"}',
          }
        },
      },
      'show appointments this week',
    )
    assert.ok('intent' in result)
    assert.equal(result.intent, 'show-appointments')
    assert.equal(result.period, 'this-week')
    assert.equal(result.status, 'pending')
  })

  it('omits period and status when the agent does not emit them', async () => {
    let result = await classifyWithAgent(
      {
        async generate() {
          return { text: '{"type":"appointment","action":"check","targetQuery":"42"}' }
        },
      },
      'show appointments for 42',
    )
    assert.ok('intent' in result)
    assert.equal(result.period, undefined)
    assert.equal(result.status, undefined)
  })

  it('classifies delete-resource with both user and resource queries', async () => {
    let bus = new EventBus()
    bus.register(classifyHandler)
    let intent: unknown = null
    let targetQuery: unknown = null
    let resourceQuery: unknown = null

    for await (let event of bus.run({
      type: 'request.validated',
      message: 'delete all appointments for user@newapp.com in raum 1',
      ...ADMIN_USER,
    })) {
      if (event.type === 'intent.classified') {
        intent = event.intent
        targetQuery = event.params.targetQuery
        resourceQuery = event.params.resourceQuery
      }
    }

    assert.equal(intent, 'delete-appointments')
    assert.equal(targetQuery, 'user@newapp.com')
    assert.equal(resourceQuery, 'raum 1')
  })

  it('emits unclear when delete-resource lacks a resource', async () => {
    let result = await classifyWithAgent(
      {
        async generate() {
          return { text: '{"type":"appointment","action":"delete-resource","targetQuery":"42"}' }
        },
      },
      'delete appointments',
    )
    assert.ok('unclear' in result)
  })

  it('classifies a bare user lookup as lookup-user', async () => {
    let result = await classifyWithAgent(
      {
        async generate() {
          return { text: '{"type":"user-action","action":"lookup","targetQuery":"42"}' }
        },
      },
      'find user 42',
    )
    assert.ok('intent' in result)
    assert.equal(result.intent, 'lookup-user')
    assert.equal(result.targetQuery, '42')
  })

  it('emits unclear for lookup without a target', async () => {
    let result = await classifyWithAgent(
      {
        async generate() {
          return { text: '{"type":"user-action","action":"lookup"}' }
        },
      },
      'find someone',
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

  it('lookup-user intent navigates to the users grid without a workflow', async () => {
    let bus = new EventBus()
    bus.register(dispatchHandler)
    let navHref: unknown = null
    let requested = false

    for await (let event of bus.run({
      type: 'entities.resolved',
      intent: 'lookup-user',
      params: { targetQuery: 'john doe' },
      resolved: { targetQuery: 'john doe' },
      ...ADMIN_USER,
    })) {
      if (event.type === 'navigate') navHref = event.href
      if (event.type === 'workflow.requested') requested = true
    }

    assert.ok(navHref, 'should emit a navigate event')
    assert.ok(String(navHref).includes('/admin/users'))
    assert.ok(String(navHref).includes('filter=john%20doe'))
    assert.equal(requested, false, 'lookup must not start a workflow')
  })

  it('show-appointments intent carries period and status filters on the navigation', async () => {
    let bus = new EventBus()
    bus.register(dispatchHandler as EventHandler)
    let navHref: unknown = null

    for await (let event of bus.run({
      type: 'entities.resolved',
      intent: 'show-appointments',
      params: { targetQuery: 'admin@test.com', period: 'this-week', status: 'pending' },
      resolved: { targetEmail: 'admin@test.com' },
      ...ADMIN_USER,
    })) {
      if (event.type === 'navigate') navHref = event.href
    }

    assert.ok(navHref)
    assert.ok(String(navHref).includes('/verwaltung/appointments'))
    assert.ok(String(navHref).includes('filter=admin%40test.com'))
    assert.ok(String(navHref).includes('period=this-week'))
    assert.ok(String(navHref).includes('status=pending'))
  })

  it('drops invalid period and status values from the navigation', async () => {
    let bus = new EventBus()
    bus.register(dispatchHandler as EventHandler)
    let navHref: unknown = null

    for await (let event of bus.run({
      type: 'entities.resolved',
      intent: 'show-appointments',
      params: { targetQuery: 'admin@test.com', period: 'drop table', status: 'all' },
      resolved: { targetEmail: 'admin@test.com' },
      ...ADMIN_USER,
    })) {
      if (event.type === 'navigate') navHref = event.href
    }

    assert.ok(navHref)
    assert.ok(!String(navHref).includes('period='))
    assert.ok(!String(navHref).includes('status='))
  })

  it('delete-appointments intent routes to the delete workflow', async () => {
    let bus = new EventBus()
    bus.register(dispatchHandler)
    let requested: Record<string, unknown> | null = null

    for await (let event of bus.run({
      type: 'entities.resolved',
      intent: 'delete-appointments',
      params: { targetQuery: 'user@newapp.com', resourceQuery: 'raum 1' },
      resolved: {
        targetUserId: 2,
        targetEmail: 'user@newapp.com',
        resourceId: 1,
        targetQuery: 'user@newapp.com',
        resourceQuery: 'raum 1',
      },
      ...ADMIN_USER,
    })) {
      if (event.type === 'workflow.requested') {
        requested = event as Record<string, unknown>
      }
    }

    assert.ok(requested, 'should emit workflow.requested')
    assert.equal(requested!.workflowId, 'deleteUserAppointmentsWorkflow')
    let input = requested!.input as Record<string, unknown>
    assert.equal(input.action, 'delete-resource')
    assert.equal(input.targetUserId, 2)
    assert.equal(input.resourceId, 1)
    assert.equal((requested!.navigate as Record<string, unknown>).target, 'agent-events-panel')
    assert.ok(
      String((requested!.navigate as Record<string, unknown>).href).includes(
        '/verwaltung/appointments',
      ),
    )
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

  it('lookup-user resolves the target against the DB and navigates without a workflow', async () => {
    await initializeAppDatabase()
    let bus = new EventBus()
    registerHandlers(bus)
    let eventTypes: string[] = []
    let navHref: unknown = null

    for await (let event of bus.run({
      type: 'request.received',
      message: 'find user admin@newapp.com',
      ...ADMIN_USER,
    })) {
      eventTypes.push(event.type)
      if (event.type === 'navigate') navHref = event.href
    }

    assert.ok(eventTypes.includes('entities.resolved'), 'lookup should resolve the user')
    assert.ok(eventTypes.includes('navigate'), 'lookup should navigate')
    assert.ok(String(navHref).includes('/admin/users'))
    assert.ok(!eventTypes.includes('workflow.requested'), 'lookup must not start a workflow')
  })

  it('lookup-user of an unknown user emits entities.notfound', async () => {
    await initializeAppDatabase()
    let bus = new EventBus()
    registerHandlers(bus)
    let eventTypes: string[] = []

    for await (let event of bus.run({
      type: 'request.received',
      message: 'find user 999999',
      ...ADMIN_USER,
    })) {
      eventTypes.push(event.type)
    }

    assert.ok(eventTypes.includes('entities.notfound'), 'unknown lookup should be rejected')
    assert.ok(!eventTypes.includes('navigate'), 'unknown lookup must not navigate to the grid')
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

  it('retired /admin/workflow-agent path no longer resolves', async () => {
    let session = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    if (!session) throw new Error('Failed to create auth session')
    let response = await router.fetch(`${BASE}/admin/workflow-agent`, {
      redirect: 'manual',
      headers: { Cookie: session.cookie },
    })
    assert.notEqual(response.status, 200, 'retired workflow-agent page must not render')
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

  it('appointment check navigates with period and status filters', async () => {
    let response = await postForm(AGENT_EVENTS_URL, adminCookie, {
      message: 'show pending appointments for admin@test.com next week',
    })
    assert.equal(response.status, 200)
    let text = await response.text()
    assert.ok(text.includes('"href":"/verwaltung/appointments?filter=admin%40test.com&period=next-week&status=pending"'))
  })

  it('resume rejects missing runId with 400', async () => {
    let response = await postForm(AGENT_EVENTS_URL + '/resume', adminCookie, {
      confirmed: 'true',
    })
    assert.equal(response.status, 400)
  })

  it('resume rejects an unknown run with no workflowId (no workflow guessing)', async () => {
    // A resume must never silently default to userManagementWorkflow when the run
    // is unknown — that would re-attach a delete run to the wrong workflow.
    let response = await postForm(AGENT_EVENTS_URL + '/resume', adminCookie, {
      runId: 'unknown-run-without-mapping',
      confirmed: 'true',
    })
    assert.equal(response.status, 400)
  })

  it('resume rejects a run indexed to another admin (ownership check)', async () => {
    let otherEmail = `other-admin-${Date.now()}@newapp.com`
    let otherAdminResult = await db.exec(
      `INSERT INTO users (email, password_hash, name, role, email_verified, token_version, created_at)
       VALUES ($1, $2, $3, 'admin', 1, 1, $4) RETURNING id`,
      [otherEmail, 'hashed', 'Other Admin', Date.now()],
    )
    let otherAdminId = ((otherAdminResult.rows ?? [])[0] as { id: number }).id
    let otherAuth = await createAuthCookieWithCsrfForUser(otherEmail)
    assert.ok(otherAuth, 'other admin should get a session')

    // Index a suspended run to the OTHER admin, then try to resume it as the
    // primary admin — must be rejected, not silently resumed.
    await upsertActiveRun(otherAdminId, {
      runId: 'run-owned-by-other',
      workflowId: 'userManagementWorkflow',
      status: 'running',
    })
    await markSuspended(otherAdminId, 'run-owned-by-other', 'confirm-gate', {
      question: 'Cancel?',
      actionType: 'cancel',
      targetUserName: 'Jane',
      pendingCount: 1,
    })
    let row = await findRunById('run-owned-by-other')
    assert.equal(row?.adminUserId, otherAdminId, 'run should be indexed to the other admin')

    try {
      let response = await postForm(AGENT_EVENTS_URL + '/resume', adminCookie, {
        runId: 'run-owned-by-other',
        confirmed: 'true',
      })
      assert.equal(response.status, 400, 'cross-admin resume must be rejected')
    } finally {
      await clearActiveRun(otherAdminId, 'run-owned-by-other')
      await db.exec('DELETE FROM users WHERE id = $1', [otherAdminId])
    }
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
    let captured: { confirmed?: boolean | undefined } = {}
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
        workflowId: 'userManagementWorkflow',
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
        workflowId: 'userManagementWorkflow',
        confirmed: 'true',
      })
      assert.equal(response.status, 200)
      let text = await response.text()
      assert.ok(text.includes('agent-error'), 'invalid run should emit agent-error')
    } finally {
      __setRunFactory(undefined)
    }
  })

  it('delete-resource runs the delete workflow and resume reuses the recorded workflow', async () => {
    let resourceResult = await db.exec('SELECT id, name FROM resources ORDER BY id ASC LIMIT 1')
    let resourceRow = (resourceResult.rows ?? [])[0] as { id: number; name: string } | undefined
    if (!resourceRow) return // skip if no resources seeded

    let message = `delete all appointments for user@newapp.com in ${resourceRow.name}`
    FAKE_CLASSIFY_TABLE[message] = JSON.stringify({
      type: 'appointment',
      action: 'delete-resource',
      targetQuery: 'user@newapp.com',
      resourceQuery: resourceRow.name,
    })

    let calls: Array<{ workflowId: string; runId?: string | undefined; confirmed?: boolean | undefined }> = []
    __setRunFactory(async (workflowId, opts) => {
      calls.push({
        workflowId,
        runId: opts.runId,
        confirmed: (opts.resumeData as { confirmed?: boolean } | undefined)?.confirmed,
      })
      if (opts.runId != null) {
        return {
          runId: opts.runId,
          fullStream: streamOf({
            type: 'workflow-finish',
            payload: { workflowStatus: 'success', success: true },
          }),
        }
      }
      return {
        runId: 'run-del-appts',
        fullStream: streamOf({
          type: 'workflow-step-suspended',
          payload: {
            id: 'confirm-gate',
            suspendPayload: {
              question: 'Delete?',
              actionType: 'delete-appointments',
              targetUserName: 'John Doe',
              resourceName: resourceRow.name,
              pendingCount: 2,
            },
          },
        }),
      }
    })
    try {
      let response = await postForm(AGENT_EVENTS_URL, adminCookie, { message })
      assert.equal(response.status, 200)
      let text = await response.text()
      assert.ok(text.includes('event: start'), 'should emit start')
      assert.ok(text.includes('run-del-appts'), 'should carry the run id')
      assert.ok(text.includes('workflow-step-suspended'), 'should emit the suspended step')
      assert.ok(
        calls.some((c) => c.workflowId === 'deleteUserAppointmentsWorkflow'),
        'should start the delete workflow',
      )

      let resumeResponse = await postForm(AGENT_EVENTS_URL + '/resume', adminCookie, {
        runId: 'run-del-appts',
        confirmed: 'true',
      })
      assert.equal(resumeResponse.status, 200)
      let resumeCall = calls[calls.length - 1]!
      assert.equal(
        resumeCall.workflowId,
        'deleteUserAppointmentsWorkflow',
        'resume should reuse the recorded workflow',
      )
      assert.equal(resumeCall.confirmed, true, 'resume should pass the confirmed flag')
    } finally {
      __setRunFactory(undefined)
    }
  })

  it('routes delete-resource errors to the appointments grid, user errors to the users grid', async () => {
    // M1: a delete-resource resolution failure must land the panel on the
    // appointments grid — never the users grid (which the notfound handler
    // used to hardcode for every error).
    let deleteResponse = await postForm(AGENT_EVENTS_URL, adminCookie, {
      message: 'delete appointments for nobody@example.com in no-such-room',
    })
    assert.equal(deleteResponse.status, 200)
    let deleteText = await deleteResponse.text()
    assert.ok(
      deleteText.includes('"href":"/verwaltung/appointments"'),
      'delete-resource failure should navigate to the appointments frame',
    )
    assert.ok(
      !deleteText.includes('"href":"/admin/users"'),
      'delete-resource failure must not navigate to the users grid',
    )

    // User-action failures still land on the users grid.
    let userResponse = await postForm(AGENT_EVENTS_URL, adminCookie, {
      message: 'cancel user 999999',
    })
    assert.equal(userResponse.status, 200)
    let userText = await userResponse.text()
    assert.ok(
      userText.includes('"href":"/admin/users"'),
      'user-action failure should navigate to the users grid',
    )
  })
})

describe('active-run-store', () => {
  let adminUserId: number

  before(async () => {
    await initializeAppDatabase()
    let userResult = await db.exec('SELECT id FROM users WHERE email = $1', ['admin@newapp.com'])
    adminUserId = ((userResult.rows ?? [])[0] as { id: number }).id
  })

  async function clearIndex() {
    await db.exec('DELETE FROM admin_active_runs WHERE admin_user_id = $1', [adminUserId])
  }

  it('upserts a running run and finds it by admin', async () => {
    await clearIndex()
    await upsertActiveRun(adminUserId, {
      runId: 'store-run-1',
      workflowId: 'userManagementWorkflow',
      status: 'running',
    })
    let row = await findActiveRun(adminUserId)
    assert.equal(row?.runId, 'store-run-1')
    assert.equal(row?.status, 'running')
    assert.equal(row?.suspendPayload, null)
  })

  it('upsert replaces the previous run (one active run per admin)', async () => {
    await clearIndex()
    await upsertActiveRun(adminUserId, {
      runId: 'store-run-old',
      workflowId: 'userManagementWorkflow',
      status: 'running',
    })
    await upsertActiveRun(adminUserId, {
      runId: 'store-run-new',
      workflowId: 'deleteUserAppointmentsWorkflow',
      status: 'running',
    })
    let row = await findActiveRun(adminUserId)
    assert.equal(row?.runId, 'store-run-new')
    assert.equal(row?.workflowId, 'deleteUserAppointmentsWorkflow')
  })

  it('markSuspended records the step and payload', async () => {
    await clearIndex()
    await upsertActiveRun(adminUserId, {
      runId: 'store-run-suspend',
      workflowId: 'userManagementWorkflow',
      status: 'running',
    })
    await markSuspended(adminUserId, 'store-run-suspend', 'confirm-gate', {
      question: 'Cancel Jane?',
      actionType: 'cancel',
      targetUserName: 'Jane',
      pendingCount: 2,
    })
    let row = await findActiveRun(adminUserId)
    assert.equal(row?.status, 'suspended')
    assert.equal(row?.stepId, 'confirm-gate')
    assert.equal((row?.suspendPayload as { question: string }).question, 'Cancel Jane?')
  })

  it('upsert clears a prior suspended run step and payload', async () => {
    await clearIndex()
    await upsertActiveRun(adminUserId, {
      runId: 'store-run-old-suspend',
      workflowId: 'userManagementWorkflow',
      status: 'running',
    })
    await markSuspended(adminUserId, 'store-run-old-suspend', 'confirm-gate', {
      question: 'Cancel Jane?',
      actionType: 'cancel',
      targetUserName: 'Jane',
      pendingCount: 2,
    })
    // A new run replaces the pointer; the stale step/payload must not bleed.
    await upsertActiveRun(adminUserId, {
      runId: 'store-run-new',
      workflowId: 'deleteUserAppointmentsWorkflow',
      status: 'running',
    })
    let row = await findActiveRun(adminUserId)
    assert.equal(row?.runId, 'store-run-new')
    assert.equal(row?.stepId, null)
    assert.equal(row?.suspendPayload, null)
  })

  it('clearActiveRun is guarded by run id (old run must not clear a newer one)', async () => {
    await clearIndex()
    await upsertActiveRun(adminUserId, {
      runId: 'store-run-a',
      workflowId: 'userManagementWorkflow',
      status: 'running',
    })
    // Admin starts run B while A is still suspended; the pointer moves to B.
    await upsertActiveRun(adminUserId, {
      runId: 'store-run-b',
      workflowId: 'userManagementWorkflow',
      status: 'running',
    })
    // A's late completion fires clearActiveRun(A) — must not clear B's row.
    await clearActiveRun(adminUserId, 'store-run-a')
    let row = await findActiveRun(adminUserId)
    assert.equal(row?.runId, 'store-run-b', 'clearing the old run must not clear the new row')

    await clearActiveRun(adminUserId, 'store-run-b')
    assert.equal(await findActiveRun(adminUserId), null)
  })

  it('findRunOwner resolves the admin for a run id', async () => {
    await clearIndex()
    await upsertActiveRun(adminUserId, {
      runId: 'store-run-owner',
      workflowId: 'userManagementWorkflow',
      status: 'running',
    })
    assert.equal(await findRunOwner('store-run-owner'), adminUserId)
    assert.equal(await findRunOwner('store-run-nonexistent'), null)
  })
})

describe('AgentEvents route (reconnect)', () => {
  let adminCookie: string
  let adminUserId: number

  before(async () => {
    await initializeAppDatabase()
    let session = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    if (!session) throw new Error('Failed to create auth session')
    adminCookie = session.cookie
    let userResult = await db.exec('SELECT id FROM users WHERE email = $1', ['admin@newapp.com'])
    adminUserId = ((userResult.rows ?? [])[0] as { id: number }).id
  })

  async function clearIndex() {
    await db.exec('DELETE FROM admin_active_runs WHERE admin_user_id = $1', [adminUserId])
  }

  it('redirects to login for unauthenticated requests', async () => {
    let response = await router.fetch(AGENT_EVENTS_RECONNECT_URL, { redirect: 'manual' })
    assert.equal(response.status, 302)
  })

  it('returns none when no active run is indexed', async () => {
    await clearIndex()
    let response = await router.fetch(AGENT_EVENTS_RECONNECT_URL, {
      headers: { Cookie: adminCookie },
    })
    assert.equal(response.status, 200)
    let body = await response.json()
    assert.equal(body.status, 'none')
  })

  it('returns the suspended run with its payload when the snapshot confirms suspension', async () => {
    await clearIndex()
    await upsertActiveRun(adminUserId, {
      runId: 'run-reconnect-suspend',
      workflowId: 'userManagementWorkflow',
      status: 'running',
    })
    await markSuspended(adminUserId, 'run-reconnect-suspend', 'confirm-gate', {
      question: 'Cancel Jane?',
      actionType: 'cancel',
      targetUserName: 'Jane',
      pendingCount: 2,
    })
    __setRunStatusResolver(async () => ({ status: 'suspended' }))
    try {
      let response = await router.fetch(AGENT_EVENTS_RECONNECT_URL, {
        headers: { Cookie: adminCookie },
      })
      assert.equal(response.status, 200)
      let body = await response.json()
      assert.equal(body.status, 'suspended')
      assert.equal(body.runId, 'run-reconnect-suspend')
      assert.equal(body.workflowId, 'userManagementWorkflow')
      assert.equal(body.stepId, 'confirm-gate')
      assert.equal(body.suspendPayload.question, 'Cancel Jane?')
      assert.equal(body.suspendPayload.targetUserName, 'Jane')
    } finally {
      __setRunStatusResolver(undefined)
    }
  })

  it('clears a stale index and returns none when the run is no longer suspended', async () => {
    await clearIndex()
    await upsertActiveRun(adminUserId, {
      runId: 'run-reconnect-stale',
      workflowId: 'userManagementWorkflow',
      status: 'running',
    })
    await markSuspended(adminUserId, 'run-reconnect-stale', 'confirm-gate', {
      question: 'Cancel Jane?',
      actionType: 'cancel',
      targetUserName: 'Jane',
      pendingCount: 2,
    })
    __setRunStatusResolver(async () => ({ status: 'finished' }))
    try {
      let response = await router.fetch(AGENT_EVENTS_RECONNECT_URL, {
        headers: { Cookie: adminCookie },
      })
      assert.equal(response.status, 200)
      let body = await response.json()
      assert.equal(body.status, 'none')
      let row = await findActiveRun(adminUserId)
      assert.equal(row, null, 'stale index row should be cleared')
    } finally {
      __setRunStatusResolver(undefined)
    }
  })

  it('clears a stale index and returns none when the run is missing from storage', async () => {
    await clearIndex()
    await upsertActiveRun(adminUserId, {
      runId: 'run-reconnect-missing',
      workflowId: 'userManagementWorkflow',
      status: 'running',
    })
    await markSuspended(adminUserId, 'run-reconnect-missing', 'confirm-gate', {
      question: 'Cancel Jane?',
      actionType: 'cancel',
      targetUserName: 'Jane',
      pendingCount: 2,
    })
    __setRunStatusResolver(async () => null)
    try {
      let response = await router.fetch(AGENT_EVENTS_RECONNECT_URL, {
        headers: { Cookie: adminCookie },
      })
      assert.equal(response.status, 200)
      let body = await response.json()
      assert.equal(body.status, 'none')
      let row = await findActiveRun(adminUserId)
      assert.equal(row, null, 'missing run should clear the index row')
    } finally {
      __setRunStatusResolver(undefined)
    }
  })

  it('does not clear the row for a still-running snapshot (mid-flight reload)', async () => {
    await clearIndex()
    await upsertActiveRun(adminUserId, {
      runId: 'run-reconnect-inflight',
      workflowId: 'userManagementWorkflow',
      status: 'running',
    })
    __setRunStatusResolver(async () => ({ status: 'running' }))
    try {
      let response = await router.fetch(AGENT_EVENTS_RECONNECT_URL, {
        headers: { Cookie: adminCookie },
      })
      assert.equal(response.status, 200)
      let body = await response.json()
      assert.equal(body.status, 'none')
      let row = await findActiveRun(adminUserId)
      assert.equal(
        row?.runId,
        'run-reconnect-inflight',
        'running row must be kept for later recovery',
      )
    } finally {
      __setRunStatusResolver(undefined)
    }
  })

  it('recovers a suspended run whose index payload is NULL (reload before the SSE loop died)', async () => {
    await clearIndex()
    // Simulate the mid-flight reload window: the row was upserted as 'running'
    // and the SSE loop died before markSuspended ran, so the index payload is
    // NULL — but the run suspended in the background and its snapshot carries
    // the gate payload.
    await upsertActiveRun(adminUserId, {
      runId: 'run-reconnect-late-suspend',
      workflowId: 'userManagementWorkflow',
      status: 'running',
    })
    __setRunStatusResolver(async () => ({
      status: 'suspended',
      stepId: 'confirm-gate',
      suspendPayload: {
        question: 'Cancel Jane?',
        actionType: 'cancel',
        targetUserName: 'Jane',
        pendingCount: 2,
      },
    }))
    try {
      let response = await router.fetch(AGENT_EVENTS_RECONNECT_URL, {
        headers: { Cookie: adminCookie },
      })
      assert.equal(response.status, 200)
      let body = await response.json()
      assert.equal(body.status, 'suspended')
      assert.equal(body.runId, 'run-reconnect-late-suspend')
      assert.equal(body.stepId, 'confirm-gate')
      assert.equal(body.suspendPayload.question, 'Cancel Jane?')
      let row = await findActiveRun(adminUserId)
      assert.equal(row?.runId, 'run-reconnect-late-suspend', 'row must be retained')
    } finally {
      __setRunStatusResolver(undefined)
    }
  })

  it('clears the index and returns none when the resolver throws', async () => {
    await clearIndex()
    await upsertActiveRun(adminUserId, {
      runId: 'run-reconnect-throw',
      workflowId: 'userManagementWorkflow',
      status: 'running',
    })
    await markSuspended(adminUserId, 'run-reconnect-throw', 'confirm-gate', {
      question: 'Cancel Jane?',
      actionType: 'cancel',
      targetUserName: 'Jane',
      pendingCount: 2,
    })
    __setRunStatusResolver(async () => {
      throw new Error('storage down')
    })
    try {
      let response = await router.fetch(AGENT_EVENTS_RECONNECT_URL, {
        headers: { Cookie: adminCookie },
      })
      assert.equal(response.status, 200)
      let body = await response.json()
      assert.equal(body.status, 'none')
      let row = await findActiveRun(adminUserId)
      assert.equal(row, null, 'resolver failure should clear the stale pointer')
    } finally {
      __setRunStatusResolver(undefined)
    }
  })
})

// Re-use the same helper as in app/db.ts pattern
import { initializeAppDatabase, db } from '../../db.ts'
