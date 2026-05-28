import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../router.ts'
import { initializeAppDatabase } from '../data/setup.ts'
import { createAuthCookieWithCsrf } from '../test-utils.ts'

// ---------------------------------------------------------------------------
// AI Fragment Controller integration tests
// Tests the agent result fragment endpoint for client-mounted frames.
// Requires a running PostgreSQL database seeded with demo users.
// ---------------------------------------------------------------------------

const BASE = 'https://remix.run'
const AGENT_RESULT_URL = `${BASE}/ai/fragments/agent-result`

describe('AI Fragments Controller', () => {
  let userCookie: string

  before(async () => {
    await initializeAppDatabase()
    let result = await createAuthCookieWithCsrf()
    userCookie = result?.cookie ?? ''
  })

  // -----------------------------------------------------------------------
  // Auth protection
  // -----------------------------------------------------------------------

  it('GET /ai/fragments/agent-result requires auth', async () => {
    let response = await router.fetch(AGENT_RESULT_URL)
    assert.equal(response.status, 302)
  })

  // -----------------------------------------------------------------------
  // Agent result rendering
  // -----------------------------------------------------------------------

  it('GET /ai/fragments/agent-result with auth returns 200', async () => {
    let response = await router.fetch(`${AGENT_RESULT_URL}?prompt=test+message`, {
      headers: { Cookie: userCookie },
    })

    assert.equal(response.status, 200)
  })

  it('GET /ai/fragments/agent-result includes the prompt text', async () => {
    let response = await router.fetch(`${AGENT_RESULT_URL}?prompt=hello+world`, {
      headers: { Cookie: userCookie },
    })

    let html = await response.text()

    // The fragment renders the prompt text
    assert.ok(html.includes('hello world'), 'should include the prompt text')
  })

  it('GET /ai/fragments/agent-result contains agent execution data', async () => {
    let response = await router.fetch(`${AGENT_RESULT_URL}?prompt=test+prompt`, {
      headers: { Cookie: userCookie },
    })

    let html = await response.text()

    // Should contain result structure
    assert.ok(html.includes('Agent Result'), 'should show agent result heading')
    assert.ok(html.includes('Execution Steps'), 'should list execution steps')
    assert.ok(html.includes('analyze'), 'should include analysis step')
    assert.ok(html.includes('process'), 'should include process step')
    assert.ok(html.includes('format'), 'should include format step')
  })

  it('GET /ai/fragments/agent-result shows fallback for missing prompt', async () => {
    let response = await router.fetch(AGENT_RESULT_URL, {
      headers: { Cookie: userCookie },
    })

    let html = await response.text()

    // Without query param, should show the fallback message
    assert.ok(html.includes('No prompt provided'), 'should show fallback prompt message')
  })

  it('renders agent result content directly', async () => {
    let response = await router.fetch(`${AGENT_RESULT_URL}?prompt=test+prompt`, {
      headers: { Cookie: userCookie },
    })

    let html = await response.text()
    // Fragment renders the agent result content
    assert.ok(html.includes('Agent Result'), 'should show agent result heading')
    assert.ok(html.includes('analyze'), 'should include analysis step')
  })
})
