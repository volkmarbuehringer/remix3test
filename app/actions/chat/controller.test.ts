import { describe, it, before, after } from 'remix/test'
import * as assert from 'remix/assert'

import { pool, initializeAppDatabase } from '../../data/setup.ts'
import { router } from '../../test-router.ts'
import { createAuthCookieWithCsrf, createAuthCookieWithCsrfForUser } from '../../test-utils.ts'
import { routes } from '../../routes.ts'
import { __setTestCustomerAgent, customerChat, chatRateLimiter } from './controller.tsx'

const BASE = 'https://remix.run'
const CHAT_INDEX_URL = `${BASE}${routes.chat.index.href()}`
const CHAT_ACTION_URL = `${BASE}${routes.chat.action.href()}`

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

  after(() => {
    __setTestCustomerAgent(undefined)
  })

  it('GET /chat redirects to login when not authenticated', async () => {
    let response = await router.fetch(CHAT_INDEX_URL, { redirect: 'manual' })
    assert.equal(response.status, 302)
    let location = response.headers.get('Location')
    assert.ok(
      location?.startsWith(routes.auth.login.index.href()),
      'should redirect to login with returnTo',
    )
  })

  it('GET /chat returns page for authenticated user', async () => {
    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    let response = await router.fetch(CHAT_INDEX_URL, {
      headers: { Cookie: session.cookie },
    })
    assert.equal(response.status, 200)
  })

  it('GET /chat works for non-admin user', async () => {
    let response = await router.fetch(CHAT_INDEX_URL, {
      headers: { Cookie: userCookie },
    })
    assert.equal(response.status, 200)
  })

  it('POST /chat with empty message returns redirect with error', async () => {
    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    let response = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: new URLSearchParams({ message: '', _csrf: session.csrfToken }),
      redirect: 'manual',
    })

    assert.equal(response.status, 302)
  })

  it('POST /chat with valid message returns redirect with threadId using mock agent', async () => {
    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    let mockAgent = {
      generate: async (_message: string, _opts?: any) => ({
        text: 'Ich empfehle Ihnen Raum 1, der für Ihre Bedürfnisse geeignet ist.',
      }),
    }
    __setTestCustomerAgent(mockAgent)

    let response = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: new URLSearchParams({ message: 'Ich brauche einen ruhigen Raum', _csrf: session.csrfToken }),
      redirect: 'manual',
    })

    assert.equal(response.status, 302)
    let location = response.headers.get('Location')
    assert.ok(location?.includes('threadId='), 'response should redirect with threadId')

    __setTestCustomerAgent(undefined)
  })

  it('POST /chat continues an existing thread when threadId is provided', async () => {
    let existingThreadId = crypto.randomUUID()

    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    let adminResult = await pool.query('SELECT id FROM users WHERE role = $1 ORDER BY id LIMIT 1', ['admin'])
    if (adminResult.rows.length > 0) {
      chatRateLimiter.reset(adminResult.rows[0].id as number)
    }

    let mockAgent = {
      generate: async (_message: string, opts?: any) => {
        assert.equal(opts?.memory?.thread, existingThreadId)
        return { text: 'Fortsetzung der Beratung.' }
      },
    }
    __setTestCustomerAgent(mockAgent)

    let response = await router.fetch(CHAT_ACTION_URL, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: new URLSearchParams({
        message: 'weiter',
        _csrf: session.csrfToken,
        threadId: existingThreadId,
      }),
      redirect: 'manual',
    })

    assert.equal(response.status, 302)
    let location = response.headers.get('Location')
    assert.ok(location?.includes(existingThreadId), 'should continue the existing thread')

    __setTestCustomerAgent(undefined)
  })
})
