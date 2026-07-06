import { describe, it, before, after } from 'remix/test'
import * as assert from 'remix/assert'

import { db, pool, initializeAppDatabase } from '../../data/setup.ts'
import { sql } from 'remix/data-table'
import { router } from '../../test-router.ts'
import { createAuthCookieWithCsrf, createAuthCookieWithCsrfForUser } from '../../test-utils.ts'
import { routes } from '../../routes.ts'
import { createConversation } from '../../data/chatlog.ts'
import { __setTestAgent, chatRateLimiter } from './controller.tsx'

import { supportTools } from './tools/support-tools.ts'

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

    await db.exec(sql`DELETE FROM chatlog WHERE user_id IN (SELECT id FROM users WHERE email IN ('admin@newapp.com', 'user@newapp.com'))`)

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
    assert.ok(location?.startsWith(routes.auth.login.index.href()), 'should redirect to login with returnTo')
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

  it('POST /mastra/chat with empty message returns 400', async () => {
    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    let response = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, ...JSON_HEADERS },
      body: new URLSearchParams({ message: '', _csrf: session.csrfToken }),
      redirect: 'manual',
    })

    assert.equal(response.status, 400)
    let json = await response.json() as { error?: string }
    assert.ok(json.error, 'response should include an error message')
  })

  it('POST /mastra/chat with whitespace-only message returns 400', async () => {
    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    let response = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, ...JSON_HEADERS },
      body: new URLSearchParams({ message: '   ', _csrf: session.csrfToken }),
      redirect: 'manual',
    })

    assert.equal(response.status, 400)
    let json = await response.json() as { error?: string }
    assert.ok(json.error, 'response should include an error message')
  })

  it('POST /mastra/chat triggers rate limit on rapid requests', async () => {
    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    // First POST consumes a rate-limit token (fails at agent call since no API key, but rate limit is consumed)
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
    let json = await second.json() as { error?: string }
    assert.ok(json.error, '429 response should include an error message')
  })

  it('POST /mastra/chat with valid message returns 200 and response text using mock agent', async () => {
    let adminId = (await pool.query('SELECT id FROM users WHERE email = $1', ['admin@newapp.com'])).rows[0]?.id as number
    chatRateLimiter.reset(adminId)

    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    let mockAgent = {
      generate: async (_message: string, _opts?: any) => ({ text: 'Here is the user data you requested.' }),
    }
    __setTestAgent(mockAgent)

    let response = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, ...JSON_HEADERS },
      body: new URLSearchParams({ message: 'show user admin', _csrf: session.csrfToken }),
      redirect: 'manual',
    })

    assert.equal(response.status, 200)
    let json = await response.json() as { response?: string; threadId?: string }
    assert.equal(json.response, 'Here is the user data you requested.')
    assert.ok(json.threadId, 'response should include a threadId')
    assert.ok(json.threadId!.length > 0, 'threadId should be a non-empty string')

    __setTestAgent(undefined)
  })

  it('POST /mastra/chat continues an existing thread when threadId is provided', async () => {
    let adminId = (await pool.query('SELECT id FROM users WHERE email = $1', ['admin@newapp.com'])).rows[0]?.id as number
    chatRateLimiter.reset(adminId)

    let existingThreadId = await createConversation(db, adminId)
    assert.ok(existingThreadId, 'should create a chatlog conversation')

    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    let mockAgent = {
      generate: async (_message: string, opts?: any) => {
        assert.equal(opts?.memory?.thread, existingThreadId, 'threadId should be passed to memory')
        assert.equal(opts?.memory?.resource, String(adminId), 'resource should be scoped to user')
        return { text: 'Continuing conversation.' }
      },
    }
    __setTestAgent(mockAgent)

    let response = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie, ...JSON_HEADERS },
      body: new URLSearchParams({ message: 'follow-up', _csrf: session.csrfToken, threadId: existingThreadId }),
      redirect: 'manual',
    })

    assert.equal(response.status, 200)
    let json = await response.json() as { response?: string; threadId?: string }
    assert.equal(json.response, 'Continuing conversation.')
    assert.equal(json.threadId, existingThreadId, 'should echo back the provided threadId')

    __setTestAgent(undefined)
  })
})

function execTool(tool: Record<string, unknown>, input: Record<string, unknown>) {
  let fn = tool.execute as ((input: Record<string, unknown>, opts: Record<string, unknown>) => Promise<Record<string, unknown>>)
  return fn(input, {})
}

describe('Mastra Chat tools', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  it('getCurrentDateTime returns shape with all fields', async () => {
    let result = await execTool(supportTools.getCurrentDateTime as unknown as Record<string, unknown>, {}) as Record<string, unknown>
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
    let result = await execTool(supportTools.lookupUser as unknown as Record<string, unknown>, { query: 'admin@newapp.com' }) as Record<string, unknown>
    assert.ok(result.found, 'should find the user')
    assert.ok(result.user, 'should return user data')
    assert.equal((result.user as Record<string, unknown>).email, 'admin@newapp.com')
    assert.equal((result.user as Record<string, unknown>).role, 'admin')
  })

  it('lookupUser finds existing user by numeric id', async () => {
    let idRow = (await pool.query('SELECT id FROM users WHERE email = $1', ['admin@newapp.com'])).rows[0]
    assert.ok(idRow, 'admin user should exist')
    let result = await execTool(supportTools.lookupUser as unknown as Record<string, unknown>, { query: String(idRow.id) }) as Record<string, unknown>
    assert.ok(result.found, 'should find the user')
    assert.equal((result.user as Record<string, unknown>).email, 'admin@newapp.com')
  })

  it('lookupUser returns not found for unknown email', async () => {
    let result = await execTool(supportTools.lookupUser as unknown as Record<string, unknown>, { query: 'nonexistent@example.com' }) as Record<string, unknown>
    assert.ok(!result.found, 'should not find the user')
    assert.ok(result.message, 'should include a message')
  })

  it('countUsers returns totals grouped by role', async () => {
    let result = await execTool(supportTools.countUsers as unknown as Record<string, unknown>, {}) as Record<string, unknown>
    assert.ok((result.total as number) > 1, 'should have at least 2 users')
    assert.ok(result.byRole, 'should have byRole breakdown')
    assert.ok(typeof (result.byRole as Record<string, unknown>).admin === 'number', 'admin count should be a number')
    assert.ok(typeof (result.byRole as Record<string, unknown>).customer === 'number', 'customer count should be a number')
  })

  it('countUsers filters by role', async () => {
    let result = await execTool(supportTools.countUsers as unknown as Record<string, unknown>, { role: 'admin' }) as Record<string, unknown>
    assert.equal(result.total, (result.byRole as Record<string, unknown>).admin, 'total should match admin count when filtered')
    assert.equal(Object.keys(result.byRole as Record<string, unknown>).length, 1, 'only admin role should be present')
  })

  it('listRecentAppointments returns appointments', async () => {
    let result = await execTool(supportTools.listRecentAppointments as unknown as Record<string, unknown>, { limit: 5 }) as Record<string, unknown>
    assert.ok(Array.isArray(result.appointments), 'appointments should be an array')
    assert.ok((result.count as number) >= 0, 'count should be non-negative')
    if ((result.count as number) > 0) {
      let appt = (result.appointments as Record<string, unknown>[])[0]
      assert.ok(typeof appt.id === 'number', 'appointment id should be a number')
      assert.ok(typeof appt.title === 'string', 'appointment title should be a string')
    }
  })

  it('listRecentAppointments filters by userId', async () => {
    let idRow = (await pool.query('SELECT id FROM users WHERE email = $1', ['user@newapp.com'])).rows[0]
    assert.ok(idRow, 'user should exist')
    let result = await execTool(supportTools.listRecentAppointments as unknown as Record<string, unknown>, { limit: 5, userId: idRow.id }) as Record<string, unknown>
    assert.ok(Array.isArray(result.appointments), 'appointments should be an array')
    if ((result.count as number) > 0) {
      for (let appt of (result.appointments as Record<string, unknown>[])) {
        assert.ok(typeof appt.title === 'string', 'appointment should have a title')
      }
    }
  })
})
