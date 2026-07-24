import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { initializeAppDatabase } from '../../data/setup.ts'
import { pool } from '../../data/test-pool.ts'
import { router } from '../../test-router.ts'
import { createAuthCookieWithCsrfForUser } from '../../test-utils.ts'
import { workflowAgentRateLimiter, __setTestAgent } from './controller.tsx'
import type { AgentStreamOutput, TestAgent } from '../mastra/shared-agent.ts'

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
    assert.ok(text.includes('</textarea>'), 'input should be a textarea element')
    assert.ok(text.includes('chat-messages'), 'should have chat-messages conversation container')
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

// ── SSE response parser ──

async function parseSSEResponse(
  response: Response,
): Promise<{ events: Array<{ type: string; data: string }>; text: string }> {
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

function createMockNavigateStream(
  path: string,
  runId?: string,
): AgentStreamOutput {
  let id = runId || crypto.randomUUID()
  return {
    runId: id,
    fullStream: new ReadableStream({
      start(controller) {
        controller.enqueue({
          type: 'tool-result',
          payload: {
            toolCallId: 'mock-tool-call',
            toolName: 'navigate',
            result: { type: 'route', path },
          },
        })
        controller.enqueue({ type: 'finish', payload: {} })
        controller.close()
      },
    }),
    getFullOutput: async () => ({ text: '', finishReason: 'stop' }),
  }
}

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

  it('toolDecision returns suspension event for tool approval', async () => {
    workflowAgentRateLimiter.reset(adminId)

    let mockAgent: TestAgent = {
      generate: async () => ({ text: '' }),
      stream: async () => createMockStreamOutput(''),
      resumeStream: async () => createMockStreamOutput(''),
      approveToolCallGenerate: async () => ({
        finishReason: 'suspended',
        suspendPayload: {
          toolCallId: 'tool-call-123',
          toolName: 'cancel_user_workflow_v2',
          args: { targetUserId: 42 },
        },
      }),
      declineToolCallGenerate: async () => ({ text: 'declined' }),
    }
    __setTestAgent(mockAgent)

    let response = await postForm(WORKFLOW_AGENT_TOOL_DECISION_URL, adminCookie, {
      runId: 'test-run',
      decision: 'approve',
    })

    assert.equal(response.status, 200)
    let { events } = await parseSSEResponse(response)
    let suspensionEvent = events.find((e) => e.type === 'suspension')
    assert.ok(suspensionEvent, 'should have a suspension event')
    let data = JSON.parse(suspensionEvent!.data)
    assert.equal(data.toolName, 'cancel_user_workflow_v2')
    assert.equal(data.toolCallId, 'tool-call-123')

    __setTestAgent(undefined)
  })

  it('toolDecision returns question event for question suspension', async () => {
    workflowAgentRateLimiter.reset(adminId)

    let mockAgent: TestAgent = {
      generate: async () => ({ text: '' }),
      stream: async () => createMockStreamOutput(''),
      resumeStream: async () => createMockStreamOutput(''),
      approveToolCallGenerate: async () => ({
        finishReason: 'suspended',
        suspendPayload: {
          question: 'What would you like to do?',
          options: [{ label: 'Lock user 5' }, { label: 'Ready' }],
          selectionMode: 'single_select',
        },
      }),
      declineToolCallGenerate: async () => ({ text: 'declined' }),
    }
    __setTestAgent(mockAgent)

    let response = await postForm(WORKFLOW_AGENT_TOOL_DECISION_URL, adminCookie, {
      runId: 'test-run',
      decision: 'approve',
    })

    assert.equal(response.status, 200)
    let { events } = await parseSSEResponse(response)
    let questionEvent = events.find((e) => e.type === 'question')
    assert.ok(questionEvent, 'should have a question event')
    let data = JSON.parse(questionEvent!.data)
    assert.equal(data.question, 'What would you like to do?')
    assert.equal(data.options.length, 2)
    assert.equal(data.options[0].label, 'Lock user 5')

    __setTestAgent(undefined)
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

describe('WorkflowAgent appointment navigation', () => {
  let adminCookie: string
  let adminId: number

  before(async () => {
    await initializeAppDatabase()
    let session = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    if (!session) throw new Error('Failed to create auth session')
    adminCookie = session.cookie
    adminId = await getAdminId()
  })

  it('navigates to /verwaltung/appointments when asked about appointments this week', async () => {
    workflowAgentRateLimiter.reset(adminId)

    let mockAgent: TestAgent = {
      generate: async () => ({ text: '' }),
      stream: async () =>
        createMockNavigateStream('/verwaltung/appointments?period=this_week'),
      resumeStream: async () => createMockStreamOutput(''),
    }
    __setTestAgent(mockAgent)

    let response = await postForm(WORKFLOW_AGENT_URL, adminCookie, {
      message: 'show me appointments this week',
    })

    assert.equal(response.status, 200)
    let { events } = await parseSSEResponse(response)
    let navigateEvent = events.find((e) => e.type === 'navigate')
    assert.ok(navigateEvent, 'should have a navigate event')
    let data = JSON.parse(navigateEvent!.data)
    assert.ok(data.href.startsWith('/verwaltung/appointments'), `expected appointments path, got ${data.href}`)
    assert.ok(data.href.includes('period='), `expected period param, got ${data.href}`)
    assert.equal(data.target, 'admin-content')

    __setTestAgent(undefined)
  })

  it('navigates to /verwaltung/appointments with filter for user appointments', async () => {
    workflowAgentRateLimiter.reset(adminId)

    let mockAgent2: TestAgent = {
      generate: async () => ({ text: '' }),
      stream: async () =>
        createMockNavigateStream('/verwaltung/appointments?filter=5'),
      resumeStream: async () => createMockStreamOutput(''),
    }
    __setTestAgent(mockAgent2)

    let response = await postForm(WORKFLOW_AGENT_URL, adminCookie, {
      message: 'what appointments does user 5 have',
    })

    assert.equal(response.status, 200)
    let { events } = await parseSSEResponse(response)
    let navigateEvent = events.find((e) => e.type === 'navigate')
    assert.ok(navigateEvent, 'should have a navigate event')
    let data = JSON.parse(navigateEvent!.data)
    assert.ok(data.href.includes('filter='), `expected filter param, got ${data.href}`)

    __setTestAgent(undefined)
  })

  it('navigates to plain /verwaltung/appointments without params for generic query', async () => {
    workflowAgentRateLimiter.reset(adminId)

    let mockAgent3: TestAgent = {
      generate: async () => ({ text: '' }),
      stream: async () =>
        createMockNavigateStream('/verwaltung/appointments'),
      resumeStream: async () => createMockStreamOutput(''),
    }
    __setTestAgent(mockAgent3)

    let response = await postForm(WORKFLOW_AGENT_URL, adminCookie, {
      message: 'show appointments',
    })

    assert.equal(response.status, 200)
    let { events } = await parseSSEResponse(response)
    let navigateEvent = events.find((e) => e.type === 'navigate')
    assert.ok(navigateEvent, 'should have a navigate event')
    let data = JSON.parse(navigateEvent!.data)
    assert.equal(data.href, '/verwaltung/appointments')

    __setTestAgent(undefined)
  })
})
