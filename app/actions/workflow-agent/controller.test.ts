import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { initializeAppDatabase } from '../../data/setup.ts'
import { router } from '../../test-router.ts'
import { createAuthCookieWithCsrfForUser } from '../../test-utils.ts'

const BASE = 'https://remix.run'
const WORKFLOW_AGENT_URL = `${BASE}/workflow-agent`
const WORKFLOW_AGENT_PANEL_URL = `${BASE}/workflow-agent/panel`

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
    assert.ok(text.includes('wf-status-bar'), 'should have status bar')
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

  it('resume rejects missing runId with 400', async () => {
    let response = await postForm(WORKFLOW_AGENT_URL + '/resume', adminCookie, {
      confirmed: 'true',
    })
    assert.equal(response.status, 400)
    let text = await response.text()
    assert.ok(text.includes('Missing runId'), `unexpected body: ${text}`)
  })
})
