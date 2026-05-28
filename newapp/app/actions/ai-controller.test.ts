import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../router.ts'
import { initializeAppDatabase } from '../data/setup.ts'
import { createAuthCookieWithCsrf } from '../test-utils.ts'

// ---------------------------------------------------------------------------
// AI Dashboard Controller integration tests
// Tests the /ai route which requires authentication.
// Requires a running PostgreSQL database seeded with demo users.
// ---------------------------------------------------------------------------

const BASE = 'https://remix.run'
const LOGIN_URL = `${BASE}/login`
const AI_URL = `${BASE}/ai`

describe('AI Dashboard controller', () => {
  // -----------------------------------------------------------------------
  // Setup
  // -----------------------------------------------------------------------

  before(async () => {
    await initializeAppDatabase()
  })

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  /** Authenticate as a regular user and return the session cookie value. */
  async function getSessionCookie(): Promise<string> {
    let result = await createAuthCookieWithCsrf()
    return result?.cookie ?? ''
  }

  // -----------------------------------------------------------------------
  // GET /ai — without auth redirects to login
  // -----------------------------------------------------------------------

  it('GET /ai without auth redirects to /login', async () => {
    let response = await router.fetch(AI_URL, { redirect: 'manual' })

    assert.equal(response.status, 302)
    let location = response.headers.get('Location')
    assert.ok(location?.startsWith('/login'), 'should redirect to /login with returnTo')
    assert.ok(location?.includes('returnTo=%2Fai'), 'should capture return path')
  })

  // -----------------------------------------------------------------------
  // GET /ai — with auth returns the dashboard
  // -----------------------------------------------------------------------

  it('GET /ai with auth returns 200', async () => {
    let session = await getSessionCookie()
    let response = await router.fetch(AI_URL, {
      headers: { Cookie: session },
    })

    assert.equal(response.status, 200)
  })

  it('GET /ai with auth contains the AI Dashboard heading', async () => {
    let session = await getSessionCookie()
    let response = await router.fetch(AI_URL, {
      headers: { Cookie: session },
    })
    let html = await response.text()

    assert.ok(html.includes('AI Dashboard'), 'page should contain "AI Dashboard" heading')
  })

  // -----------------------------------------------------------------------
  // GET /ai — sidebar navigation links
  // -----------------------------------------------------------------------

  it('GET /ai with auth contains links to Chat, Agent, and Workflows', async () => {
    let session = await getSessionCookie()
    let response = await router.fetch(AI_URL, {
      headers: { Cookie: session },
    })
    let html = await response.text()

    assert.ok(html.includes('/ai/chat'), 'should link to Chat')
    assert.ok(html.includes('/ai/agent'), 'should link to Agent')
    assert.ok(html.includes('/ai/workflow'), 'should link to Workflows')
  })

  it('GET /ai with auth displays the Open Chat and Open Agent buttons', async () => {
    let session = await getSessionCookie()
    let response = await router.fetch(AI_URL, {
      headers: { Cookie: session },
    })
    let html = await response.text()

    assert.ok(html.includes('Open Chat'), 'should have an Open Chat button')
    assert.ok(html.includes('Open Agent'), 'should have an Open Agent button')
  })
})
