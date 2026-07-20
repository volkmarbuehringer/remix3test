import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { pool, initializeAppDatabase } from '../../data/setup.ts'
import { router } from '../../test-router.ts'
import { createAuthCookieWithCsrfForUser } from '../../test-utils.ts'
import { workflowAgentRateLimiter } from './controller.tsx'

const BASE = 'https://remix.run'
const WORKFLOW_AGENT_URL = `${BASE}/workflow-agent`
const WORKFLOW_AGENT_PANEL_URL = `${BASE}/workflow-agent/panel`
const WORKFLOW_AGENT_ANSWER_URL = `${BASE}/workflow-agent/answer`
const WORKFLOW_AGENT_TOOL_DECISION_URL = `${BASE}/workflow-agent/tool-decision`

async function getAdminId(): Promise<number> {
  let r = await pool.query('SELECT id FROM users WHERE email = $1', ['admin@newapp.com'])
  return r.rows[0]?.id as number
}

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

describe('WorkflowAgent route (GET)', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  it('returns 200 for authenticated admin user', async () => {
    let session = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    if (!session) throw new Error('Failed to create auth session')
    let response = await router.fetch(WORKFLOW_AGENT_URL, {
      headers: { Cookie: session.cookie },
    })
    assert.equal(response.status, 200)
  })

  it('renders the WorkflowAgentPage with form and frame', async () => {
    let session = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    if (!session) throw new Error('Failed to create auth session')
    let response = await router.fetch(WORKFLOW_AGENT_URL, {
      headers: { Cookie: session.cookie },
    })
    let text = await response.text()
    assert.ok(text.includes('workflow-agent-frame-container'), 'should have frame container')
    assert.ok(text.includes('workflow-agent-form'), 'should have form')
    assert.ok(text.includes('workflow-agent-input'), 'should have input')
  })

  it('panel returns placeholder content', async () => {
    let session = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    if (!session) throw new Error('Failed to create auth session')
    let response = await router.fetch(WORKFLOW_AGENT_PANEL_URL, {
      headers: { Cookie: session.cookie },
    })
    assert.equal(response.status, 200)
  })

  it('redirects to login for unauthenticated requests', async () => {
    let response = await router.fetch(WORKFLOW_AGENT_URL, { redirect: 'manual' })
    assert.equal(response.status, 302)
  })

  it('returns 403 for non-admin authenticated user', async () => {
    let customerSession = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!customerSession) throw new Error('Failed to create customer session')
    let response = await router.fetch(WORKFLOW_AGENT_URL, {
      headers: { Cookie: customerSession.cookie },
    })
    assert.equal(response.status, 403)
  })
})

describe('WorkflowAgent route (POST validation)', () => {
  let adminCookie: string
  let adminId: number

  before(async () => {
    await initializeAppDatabase()
    let session = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    if (!session) throw new Error('Failed to create auth session')
    adminCookie = session.cookie
    adminId = await getAdminId()
    workflowAgentRateLimiter.reset(adminId)
  })

  it('rejects an empty message with 400', async () => {
    let response = await postForm(WORKFLOW_AGENT_URL, adminCookie, { message: '   ' })
    assert.equal(response.status, 400)
    let text = await response.text()
    assert.ok(text.includes('Message is required'), `unexpected body: ${text}`)
  })

  it('rejects an oversized message with 400', async () => {
    let response = await postForm(WORKFLOW_AGENT_URL, adminCookie, {
      message: 'x'.repeat(5001),
    })
    assert.equal(response.status, 400)
    let text = await response.text()
    assert.ok(text.includes('Message too long'), `unexpected body: ${text}`)
  })

  it('answer rejects missing runId or answer with 400', async () => {
    let response = await postForm(WORKFLOW_AGENT_ANSWER_URL, adminCookie, {})
    assert.equal(response.status, 400)
    let text = await response.text()
    assert.ok(text.includes('Missing runId or answer'), `unexpected body: ${text}`)
  })

  it('toolDecision rejects missing runId with 400', async () => {
    let response = await postForm(WORKFLOW_AGENT_TOOL_DECISION_URL, adminCookie, {
      decision: 'approve',
    })
    assert.equal(response.status, 400)
    let text = await response.text()
    assert.ok(text.includes('Missing runId'), `unexpected body: ${text}`)
  })

  it('toolDecision rejects an invalid decision value with 400', async () => {
    let response = await postForm(WORKFLOW_AGENT_TOOL_DECISION_URL, adminCookie, {
      runId: 'some-run',
      decision: 'maybe',
    })
    assert.equal(response.status, 400)
    let text = await response.text()
    assert.ok(text.includes('decision must be'), `unexpected body: ${text}`)
  })

  it('rate limits after 5 requests per admin', async () => {
    // Deterministic starting point — the limiter is module-level state shared
    // with the router under test.
    workflowAgentRateLimiter.reset(adminId)

    for (let i = 0; i < 5; i++) {
      // Invalid (empty) messages still consume attempts: the limiter runs first.
      let response = await postForm(WORKFLOW_AGENT_URL, adminCookie, { message: '' })
      assert.equal(response.status, 400, `request ${i + 1} should pass the limiter`)
    }

    let limited = await postForm(WORKFLOW_AGENT_URL, adminCookie, { message: '' })
    assert.equal(limited.status, 429)
    let text = await limited.text()
    assert.ok(text.includes('Too many requests'), `unexpected body: ${text}`)

    workflowAgentRateLimiter.reset(adminId)
  })
})
