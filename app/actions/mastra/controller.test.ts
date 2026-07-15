import { describe, it, before, after } from 'remix/test'
import * as assert from 'remix/assert'

import { pool, initializeAppDatabase } from '../../data/setup.ts'
import { router } from '../../test-router.ts'
import {
  createAuthCookieWithCsrf,
  createAuthCookieWithCsrfForUser,
  createTestUser,
} from '../../test-utils.ts'
import { routes } from '../../routes.ts'
import { __setTestAgent, chatRateLimiter } from './controller.tsx'

import { supportTools } from './tools/support-tools.ts'
import { runWithAdminId } from './tools/admin-context.ts'
import type { AgentStreamOutput } from './shared-agent.ts'

// ── SSE response parser ──

async function parseSSEResponse(response: Response): Promise<{ events: Array<{ type: string; data: string }>; text: string }> {
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

// ── Weather tool mock helpers ──

function mockFetchSequence(...responses: Array<() => Promise<Response>>) {
  let callCount = 0
  return () => {
    if (callCount >= responses.length) {
      return Promise.reject(new Error('Unexpected fetch call'))
    }
    return responses[callCount++]()
  }
}

function mockResponse(overrides: Partial<Record<string, unknown>>): Promise<Response> {
  return Promise.resolve({
    ok: true,
    status: 200,
    headers: new Headers(),
    redirected: false,
    statusText: 'OK',
    type: 'basic' as ResponseType,
    url: '',
    clone() {
      return this as unknown as Response
    },
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    bytes: () => Promise.resolve(new Uint8Array()),
    formData: () => Promise.reject(new Error('Not implemented')),
    text: () => Promise.resolve(''),
    json: () => Promise.resolve(null),
    ...overrides,
  } as unknown as Response)
}

function jsonResponse(data: unknown): Promise<Response> {
  return mockResponse({ json: () => Promise.resolve(data) })
}

const BASE = 'https://remix.run'
const CHAT_INDEX_URL = `${BASE}${routes.mastra.chat.index.href()}`
const CHAT_ACTION_URL = `${BASE}${routes.mastra.chat.action.href()}`

const JSON_HEADERS = { Accept: 'application/json' }

describe('Mastra Chat controller', () => {
  let adminCookie: string
  let userCookie: string
  let userCsrfToken: string

  before(async () => {
    await initializeAppDatabase()

    let adminResult = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    adminCookie = adminResult?.cookie ?? ''

    let userResult = await createAuthCookieWithCsrfForUser('user@newapp.com')
    userCookie = userResult?.cookie ?? ''
    userCsrfToken = userResult?.csrfToken ?? ''
  })

  after(() => {
    __setTestAgent(undefined)
  })

  it('GET /mastra/chat redirects to login when not authenticated', async () => {
    let response = await router.fetch(CHAT_INDEX_URL, { redirect: 'manual' })
    assert.equal(response.status, 302)
    let location = response.headers.get('Location')
    assert.ok(
      location?.startsWith(routes.auth.login.index.href()),
      'should redirect to login with returnTo',
    )
  })

  it('POST /mastra/chat returns 403 for non-admin user', async () => {
    let response = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: userCookie, ...JSON_HEADERS },
      body: new URLSearchParams({ message: 'test', _csrf: userCsrfToken }),
      redirect: 'manual',
    })
    assert.equal(response.status, 403)
  })

  it('POST /mastra/chat with empty message returns SSE error', async () => {
    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    let response = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, ...JSON_HEADERS },
      body: new URLSearchParams({ message: '', _csrf: session.csrfToken }),
      redirect: 'manual',
    })

    assert.equal(response.status, 400)
    let { events } = await parseSSEResponse(response)
    let errorEvent = events.find(e => e.type === 'agent-error')
    assert.ok(errorEvent, 'response should include an agent-error event')
    let data = JSON.parse(errorEvent!.data)
    assert.ok(data.error, 'error event should include an error message')
  })

  it('POST /mastra/chat with whitespace-only message returns SSE error', async () => {
    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    let response = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, ...JSON_HEADERS },
      body: new URLSearchParams({ message: '   ', _csrf: session.csrfToken }),
      redirect: 'manual',
    })

    assert.equal(response.status, 400)
    let { events } = await parseSSEResponse(response)
    let errorEvent = events.find(e => e.type === 'agent-error')
    assert.ok(errorEvent, 'response should include an agent-error event')
  })

  it('POST /mastra/chat triggers rate limit on rapid requests', async () => {
    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, ...JSON_HEADERS },
      body: new URLSearchParams({ message: 'first request', _csrf: session.csrfToken }),
      redirect: 'manual',
    })

    let second = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, ...JSON_HEADERS },
      body: new URLSearchParams({ message: 'another', _csrf: session.csrfToken }),
      redirect: 'manual',
    })

    assert.equal(second.status, 429)
    let { events } = await parseSSEResponse(second)
    let errorEvent = events.find(e => e.type === 'agent-error')
    assert.ok(errorEvent, '429 response should include an agent-error event')
  })

  it('POST /mastra/chat with valid message returns SSE stream with response text', async () => {
    let adminId = (await pool.query('SELECT id FROM users WHERE email = $1', ['admin@newapp.com']))
      .rows[0]?.id as number
    chatRateLimiter.reset(adminId)

    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    let mockAgent = {
      generate: async () => ({ text: '' }),
      stream: async () => createMockStreamOutput('Here is the user data you requested.'),
      resumeStream: async () => createMockStreamOutput(''),
    }
    __setTestAgent(mockAgent)

    let response = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, ...JSON_HEADERS },
      body: new URLSearchParams({ message: 'show user admin', _csrf: session.csrfToken }),
      redirect: 'manual',
    })

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Content-Type'), 'text/event-stream')

    let { events, text } = await parseSSEResponse(response)
    assert.equal(events[0].type, 'start', 'first event should be start')
    assert.ok(JSON.parse(events[0].data).runId, 'start event should include runId')
    assert.equal(text, 'Here is the user data you requested.')
    assert.ok(events.find(e => e.type === 'complete'), 'should have a complete event')

    __setTestAgent(undefined)
  })

  it('POST /mastra/chat passes threadId to agent stream options', async () => {
    let adminId = (await pool.query('SELECT id FROM users WHERE email = $1', ['admin@newapp.com']))
      .rows[0]?.id as number
    chatRateLimiter.reset(adminId)

    let existingThreadId = crypto.randomUUID()

    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    let mockAgent = {
      generate: async () => ({ text: '' }),
      stream: async (_message: string, opts?: any) => {
        assert.equal(opts?.memory?.thread, existingThreadId, 'threadId should be passed to memory')
        assert.equal(opts?.memory?.resource, String(adminId), 'resource should be scoped to user')
        return createMockStreamOutput('Continuing conversation.')
      },
      resumeStream: async () => createMockStreamOutput(''),
    }
    __setTestAgent(mockAgent)

    let response = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, ...JSON_HEADERS },
      body: new URLSearchParams({
        message: 'follow-up',
        _csrf: session.csrfToken,
        threadId: existingThreadId,
      }),
      redirect: 'manual',
    })

    assert.equal(response.status, 200)
    let { events, text } = await parseSSEResponse(response)
    assert.equal(events[0].type, 'start', 'first event should be start')
    assert.equal(text, 'Continuing conversation.')

    __setTestAgent(undefined)
  })
})

function execTool(tool: Record<string, unknown>, input: Record<string, unknown>) {
  let fn = tool.execute as (
    input: Record<string, unknown>,
    opts: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>
  return fn(input, {})
}

describe('Mastra Chat tools', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  it('getCurrentDateTime returns shape with all fields', async () => {
    let result = (await execTool(
      supportTools.getCurrentDateTime as unknown as Record<string, unknown>,
      {},
    )) as Record<string, unknown>
    assert.ok(result, 'should return a result')
    assert.ok(typeof result.iso === 'string', 'iso should be a string')
    assert.ok(typeof result.formatted === 'string', 'formatted should be a string')
    assert.ok(typeof result.weekday === 'string', 'weekday should be a string')
    assert.ok(typeof result.year === 'number', 'year should be a number')
    assert.ok(typeof result.month === 'number', 'month should be a number')
    assert.ok(typeof result.day === 'number', 'day should be a number')
    assert.ok(typeof result.hours === 'number', 'hours should be a number')
    assert.ok(typeof result.minutes === 'number', 'minutes should be a number')
    assert.ok(typeof result.unixMs === 'number', 'unixMs should be a number')
  })

  it('lookupUser finds existing user by email', async () => {
    let result = (await execTool(supportTools.lookupUser as unknown as Record<string, unknown>, {
      query: 'admin@newapp.com',
    })) as Record<string, unknown>
    assert.ok(result.found, 'should find the user')
    assert.ok(result.user, 'should return user data')
    assert.equal((result.user as Record<string, unknown>).email, 'admin@newapp.com')
    assert.equal((result.user as Record<string, unknown>).role, 'admin')
  })

  it('lookupUser finds existing user by numeric id', async () => {
    let idRow = (await pool.query('SELECT id FROM users WHERE email = $1', ['admin@newapp.com']))
      .rows[0]
    assert.ok(idRow, 'admin user should exist')
    let result = (await execTool(supportTools.lookupUser as unknown as Record<string, unknown>, {
      query: String(idRow.id),
    })) as Record<string, unknown>
    assert.ok(result.found, 'should find the user')
    assert.equal((result.user as Record<string, unknown>).email, 'admin@newapp.com')
  })

  it('lookupUser returns not found for unknown email', async () => {
    let result = (await execTool(supportTools.lookupUser as unknown as Record<string, unknown>, {
      query: 'nonexistent@example.com',
    })) as Record<string, unknown>
    assert.ok(!result.found, 'should not find the user')
    assert.ok(result.message, 'should include a message')
  })

  it('countUsers returns totals grouped by role', async () => {
    let result = (await execTool(
      supportTools.countUsers as unknown as Record<string, unknown>,
      {},
    )) as Record<string, unknown>
    assert.ok((result.total as number) > 1, 'should have at least 2 users')
    assert.ok(result.byRole, 'should have byRole breakdown')
    assert.ok(
      typeof (result.byRole as Record<string, unknown>).admin === 'number',
      'admin count should be a number',
    )
    assert.ok(
      typeof (result.byRole as Record<string, unknown>).customer === 'number',
      'customer count should be a number',
    )
  })

  it('countUsers filters by role', async () => {
    let result = (await execTool(supportTools.countUsers as unknown as Record<string, unknown>, {
      role: 'admin',
    })) as Record<string, unknown>
    assert.equal(
      result.total,
      (result.byRole as Record<string, unknown>).admin,
      'total should match admin count when filtered',
    )
    assert.equal(
      Object.keys(result.byRole as Record<string, unknown>).length,
      1,
      'only admin role should be present',
    )
  })

  it('listRecentAppointments returns appointments', async () => {
    let result = (await execTool(
      supportTools.listRecentAppointments as unknown as Record<string, unknown>,
      { limit: 5 },
    )) as Record<string, unknown>
    assert.ok(Array.isArray(result.appointments), 'appointments should be an array')
    assert.ok((result.count as number) >= 0, 'count should be non-negative')
    if ((result.count as number) > 0) {
      let appt = (result.appointments as Record<string, unknown>[])[0]
      assert.ok(typeof appt.id === 'number', 'appointment id should be a number')
      assert.ok(typeof appt.title === 'string', 'appointment title should be a string')
    }
  })

  it('listRecentAppointments filters by userId', async () => {
    let idRow = (await pool.query('SELECT id FROM users WHERE email = $1', ['user@newapp.com']))
      .rows[0]
    assert.ok(idRow, 'user should exist')
    let result = (await execTool(
      supportTools.listRecentAppointments as unknown as Record<string, unknown>,
      { limit: 5, userId: idRow.id },
    )) as Record<string, unknown>
    assert.ok(Array.isArray(result.appointments), 'appointments should be an array')
    if ((result.count as number) > 0) {
      for (let appt of result.appointments as Record<string, unknown>[]) {
        assert.ok(typeof appt.title === 'string', 'appointment should have a title')
      }
    }
  })

  it('getWeather returns shape with expected fields on success', async () => {
    let originalFetch = globalThis.fetch
    try {
      globalThis.fetch = mockFetchSequence(
        () =>
          jsonResponse({
            results: [{ name: 'Berlin', latitude: 52.52, longitude: 13.405, country: 'Germany' }],
          }),
        () =>
          jsonResponse({
            current: {
              temperature_2m: 22.5,
              relative_humidity_2m: 65,
              weather_code: 2,
              wind_speed_10m: 12.3,
            },
          }),
      )
      let result = (await execTool(supportTools.getWeather as unknown as Record<string, unknown>, {
        location: 'Berlin',
      })) as Record<string, unknown>
      assert.ok(result, 'should return a result')
      assert.equal(result.location, 'Berlin, Germany')
      assert.equal(result.temperature, 23)
      assert.equal(result.condition, 'Partly cloudy')
      assert.equal(result.humidity, 65)
      assert.equal(result.windSpeed, 12)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('getWeather throws on unknown location', async () => {
    let originalFetch = globalThis.fetch
    try {
      globalThis.fetch = mockFetchSequence(() => jsonResponse({ results: undefined }))
      let threw = false
      try {
        await execTool(supportTools.getWeather as unknown as Record<string, unknown>, {
          location: 'Atlantis',
        })
      } catch {
        threw = true
      }
      assert.ok(threw, 'should throw when location is not found')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('getWeather has correct tool metadata', () => {
    let tool = supportTools.getWeather as unknown as Record<string, unknown>
    assert.equal(tool.id, 'get_weather')
    assert.ok(
      typeof tool.description === 'string' && tool.description.length > 0,
      'should have a description',
    )
    assert.ok(typeof tool.execute === 'function', 'should have an execute function')
    assert.ok(tool.inputSchema, 'should have an inputSchema')
  })

  it('getResourceDetails finds resource by name', async () => {
    let result = (await execTool(
      supportTools.getResourceDetails as unknown as Record<string, unknown>,
      { query: 'Room' },
    )) as Record<string, unknown>
    if (result.found) {
      assert.ok(result.resource, 'should return resource data')
      assert.ok(typeof (result.resource as Record<string, unknown>).name === 'string')
    } else {
      assert.ok(result.message, 'should include a message when not found')
    }
  })

  it('getResourceDetails returns not found for unknown resource', async () => {
    let result = (await execTool(
      supportTools.getResourceDetails as unknown as Record<string, unknown>,
      { query: 'nonexistent-resource-xyz' },
    )) as Record<string, unknown>
    assert.ok(!result.found, 'should not find the resource')
    assert.ok(result.message, 'should include a message')
  })

  it('getOfferingsForDate returns offering slots for a date', async () => {
    let dateStr = new Date().toISOString().slice(0, 10)
    let result = (await execTool(
      supportTools.getOfferingsForDate as unknown as Record<string, unknown>,
      { date: dateStr },
    )) as Record<string, unknown>
    assert.ok(typeof result.count === 'number', 'count should be a number')
    assert.ok(Array.isArray(result.offerings), 'offerings should be an array')
  })

  it('searchAppointmentsByDateRange returns appointments', async () => {
    let result = (await execTool(
      supportTools.searchAppointmentsByDateRange as unknown as Record<string, unknown>,
      { startDate: '2026-06-01', endDate: '2026-06-30' },
    )) as Record<string, unknown>
    assert.ok(typeof result.count === 'number')
    assert.ok(Array.isArray(result.appointments))
  })

  it('searchAppointmentsByDateRange rejects range over 90 days', async () => {
    let result = (await execTool(
      supportTools.searchAppointmentsByDateRange as unknown as Record<string, unknown>,
      { startDate: '2020-01-01', endDate: '2025-01-01' },
    )) as Record<string, unknown>
    assert.ok(result.error, 'should return an error for >90 day range')
  })

  it('getUserAppointments returns appointments for a user', async () => {
    let idRow = (await pool.query('SELECT id FROM users WHERE email = $1', ['user@newapp.com']))
      .rows[0]
    assert.ok(idRow, 'user should exist')
    let result = (await execTool(
      supportTools.getUserAppointments as unknown as Record<string, unknown>,
      { userId: idRow.id },
    )) as Record<string, unknown>
    assert.ok(typeof result.count === 'number')
    assert.ok(Array.isArray(result.appointments))
  })

  it('getAppointmentDetails returns found false for non-existent appointment', async () => {
    let result = (await execTool(
      supportTools.getAppointmentDetails as unknown as Record<string, unknown>,
      { id: 999999 },
    )) as Record<string, unknown>
    assert.ok(!result.found, 'should not find a non-existent appointment')
  })

  it('getOfferingConfigForResource returns shape for existing resource', async () => {
    let resourceRow = (await pool.query('SELECT id FROM resources LIMIT 1')).rows[0]
    if (!resourceRow) return // skip if no resources
    let result = (await execTool(
      supportTools.getOfferingConfigForResource as unknown as Record<string, unknown>,
      { resourceId: resourceRow.id },
    )) as Record<string, unknown>
    assert.ok('found' in result, 'should have found field')
  })

  it('getAppointTypes returns list of types', async () => {
    let result = (await execTool(
      supportTools.getAppointTypes as unknown as Record<string, unknown>,
      {},
    )) as Record<string, unknown>
    assert.ok(typeof result.count === 'number')
    assert.ok(Array.isArray(result.types))
  })

  it('searchMessages returns messages', async () => {
    let result = (await execTool(
      supportTools.searchMessages as unknown as Record<string, unknown>,
      { query: 'test' },
    )) as Record<string, unknown>
    assert.ok(typeof result.count === 'number')
    assert.ok(Array.isArray(result.messages))
  })

  it('getAdminStats returns aggregate counts', async () => {
    let result = (await execTool(
      supportTools.getAdminStats as unknown as Record<string, unknown>,
      {},
    )) as Record<string, unknown>
    assert.ok(result.users, 'should have users stats')
    assert.ok(result.appointments, 'should have appointments stats')
    assert.ok(result.resources, 'should have resources stats')
    assert.ok(result.messages, 'should have messages stats')
    assert.ok(typeof (result.users as Record<string, unknown>).total === 'number')
  })

  it('lookupHoliday returns known holiday for Christmas', async () => {
    let result = (await execTool(supportTools.lookupHoliday as unknown as Record<string, unknown>, {
      date: '2026-12-25',
    })) as Record<string, unknown>
    assert.ok(result.isHoliday, 'Christmas should be a holiday')
    assert.ok(typeof result.name === 'string' && (result.name as string).length > 0)
  })

  it('lookupHoliday returns false for non-holiday', async () => {
    let result = (await execTool(supportTools.lookupHoliday as unknown as Record<string, unknown>, {
      date: '2026-07-15',
    })) as Record<string, unknown>
    assert.ok(!result.isHoliday, 'July 15 should not be a holiday')
  })

  it('getLocationContext returns Ransbach-Baumbach location data', async () => {
    let result = (await execTool(
      supportTools.getLocationContext as unknown as Record<string, unknown>,
      {},
    )) as Record<string, unknown>
    assert.equal(result.city, 'Ransbach-Baumbach')
    assert.equal(result.country, 'Germany')
    assert.equal(result.timezone, 'Europe/Berlin')
    assert.equal(result.countryCode, 'DE')
  })

  it('generatePdfReport has correct metadata', () => {
    let tool = supportTools.generatePdfReport as unknown as Record<string, unknown>
    assert.equal(tool.id, 'generate_pdf_report')
    assert.ok(typeof tool.description === 'string' && tool.description.length > 0)
    assert.ok(typeof tool.execute === 'function')
    assert.ok(tool.inputSchema, 'should have an inputSchema')
  })

  it('cancelUserAccount returns error when canceling own account', async () => {
    let adminRow = (
      await pool.query('SELECT id, email FROM users WHERE email = $1', ['admin@newapp.com'])
    ).rows[0] as { id: number; email: string }
    let adminId = adminRow.id as number
    let result = (await runWithAdminId(adminId, () =>
      execTool(supportTools.cancelUserAccount as unknown as Record<string, unknown>, {
        targetUserId: adminId,
      }),
    )) as Record<string, unknown>
    assert.ok(!result.success, 'should fail')
    assert.equal(result.error, 'Cannot cancel your own account')
  })

  it('cancelUserAccount requires admin context', async () => {
    // Look up a non-admin user
    let userRow = (await pool.query('SELECT id FROM users WHERE email = $1', ['user@newapp.com']))
      .rows[0] as { id: number } | undefined

    // Calling without runWithAdminId should throw
    let threw = false
    try {
      await execTool(supportTools.cancelUserAccount as unknown as Record<string, unknown>, {
        targetUserId: userRow?.id ?? 9999,
      })
    } catch {
      threw = true
    }
    assert.ok(threw, 'should throw when not authenticated as admin')
  })

  it('cancelUserAccount calls workflow with admin context', async () => {
    let adminRow = (
      await pool.query('SELECT id, email FROM users WHERE email = $1', ['admin@newapp.com'])
    ).rows[0] as { id: number; email: string }

    let targetId = await createTestUser(`cancel-workflow-target-${Date.now()}@example.com`)
    if (!targetId) throw new Error('Failed to create test user')
    let targetIdForCleanup = targetId

    let result: Record<string, unknown>
    try {
      result = (await runWithAdminId(adminRow.id, () =>
        execTool(supportTools.cancelUserAccount as unknown as Record<string, unknown>, {
          targetUserId: targetId,
        }),
      )) as Record<string, unknown>

      assert.equal(result.success, true)
      assert.equal(result.targetUserId, targetId)
      assert.ok(typeof result.deletedAppointments === 'number')

      // Verify the user is actually disabled
      let check = await pool.query('SELECT disabled_at FROM users WHERE id = $1', [targetId])
      assert.ok(check.rows[0]?.disabled_at != null, 'user should be disabled')
    } finally {
      await pool.query('DELETE FROM users WHERE id = $1', [targetIdForCleanup])
    }
  })

  it('cancelUserAccount returns identifiable result shape', () => {
    let tool = supportTools.cancelUserAccount as unknown as Record<string, unknown>
    assert.equal(tool.id, 'cancel_user_account')
    assert.ok(typeof tool.description === 'string' && tool.description.length > 0)
    assert.ok(typeof tool.execute === 'function')
    assert.ok(tool.inputSchema, 'should have an inputSchema')
  })
})
