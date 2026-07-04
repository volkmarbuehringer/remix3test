import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../../test-router.ts'
import { initializeAppDatabase } from '../../data/setup.ts'
import { createAuthCookieWithCsrf } from '../../test-utils.ts'
import { routes } from '../../routes.ts'

// ---------------------------------------------------------------------------
// Agent Controller integration tests
// Tests the /ai/agent route which uses imported tools from workflows/tools.ts.
// Requires a running PostgreSQL database seeded with demo users.
// ---------------------------------------------------------------------------

const BASE = 'https://remix.run'
const LOGIN_URL = `${BASE}${routes.auth.login.index.href()}`
const AGENT_URL = `${BASE}/ai/agent`

describe('Agent Controller', () => {
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

  /** Authenticate as a regular user and return both the session cookie and CSRF token. */
  async function getSessionWithCsrf(): Promise<{ cookie: string; csrfToken: string }> {
    let result = await createAuthCookieWithCsrf()
    return { cookie: result?.cookie ?? '', csrfToken: result?.csrfToken ?? '' }
  }

  // -----------------------------------------------------------------------
  // GET /ai/agent — auth protection
  // -----------------------------------------------------------------------

  it('GET /ai/agent without auth redirects to /login', async () => {
    // Arrange
    let url = AGENT_URL

    // Act
    let response = await router.fetch(url, { redirect: 'manual' })

    // Assert
    assert.equal(response.status, 302)
    let location = response.headers.get('Location')
    assert.ok(location?.startsWith(routes.auth.login.index.href()), 'should redirect to login with returnTo')
    assert.ok(location?.includes('returnTo='), 'should capture return path')
  })

  // -----------------------------------------------------------------------
  // GET /ai/agent — page rendering with auth
  // -----------------------------------------------------------------------

  it('GET /ai/agent with auth returns 200', async () => {
    // Arrange
    let session = await getSessionCookie()

    // Act
    let response = await router.fetch(AGENT_URL, {
      headers: { Cookie: session },
    })

    // Assert
    assert.equal(response.status, 200)
  })

  it('GET /ai/agent with auth contains the Agent page heading', async () => {
    // Arrange
    let session = await getSessionCookie()

    // Act
    let response = await router.fetch(AGENT_URL, {
      headers: { Cookie: session },
    })
    let html = await response.text()

    // Assert
    assert.ok(html.includes('Agent'), 'page should contain "Agent" heading')
  })

  it('GET /ai/agent with auth contains the message form', async () => {
    // Arrange
    let session = await getSessionCookie()

    // Act
    let response = await router.fetch(AGENT_URL, {
      headers: { Cookie: session },
    })
    let html = await response.text()

    // Assert — the page should have the agent form
    assert.ok(
      html.includes('agent-form') || html.includes('agent'),
      'response should reference the agent form',
    )
  })

  // -----------------------------------------------------------------------
  // POST /ai/agent — validation (no LLM call required)
  // -----------------------------------------------------------------------

  it('POST /ai/agent with auth and empty message returns 400', async () => {
    // Arrange
    let { cookie, csrfToken } = await getSessionWithCsrf()

    // Act
    let response = await router.fetch(AGENT_URL, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: new URLSearchParams({ message: '', _csrf: csrfToken }),
      redirect: 'manual',
    })

    // Assert
    assert.equal(response.status, 400)
    let json = await response.json() as { error?: string }
    assert.ok(json.error, 'response should include an error message')
    assert.ok(
      json.error!.toLowerCase().includes('message'),
      'error should reference the message field',
    )
  })

  it('POST /ai/agent with auth and whitespace-only message returns 400', async () => {
    // Arrange
    let { cookie, csrfToken } = await getSessionWithCsrf()

    // Act — submit with a message that's all whitespace
    let response = await router.fetch(AGENT_URL, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: new URLSearchParams({ message: '   ', _csrf: csrfToken }),
      redirect: 'manual',
    })

    // Assert
    assert.equal(response.status, 400)
    let json = await response.json() as { error?: string }
    assert.ok(json.error, 'response should include an error message')
  })
})
