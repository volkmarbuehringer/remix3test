import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { initializeAppDatabase } from '../../db.ts'
import { router } from '../../test-router.ts'
import { createAuthCookieWithCsrfForUser } from '../../test-utils.ts'
import { _agentThreadId, _recordWorkflowResult, normalizeUserAction } from './controller.tsx'

const BASE = 'https://remix.run'
const WORKFLOW_AGENT_URL = `${BASE}/admin/workflow-agent`
const WORKFLOW_AGENT_PANEL_URL = `${BASE}/admin/workflow-agent/panel`

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

describe('WorkflowAgent memory thread helpers', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  it('agentThreadId returns admin-{env}-{userId} format', () => {
    let threadId = _agentThreadId(42)
    assert.ok(threadId.startsWith('admin-'), `should start with 'admin-': ${threadId}`)
    assert.ok(threadId.includes('-'), 'should contain env separator')
    assert.ok(threadId.endsWith('-42'), `should end with user id: ${threadId}`)
  })

  it('same admin has same thread ID across calls', () => {
    let id1 = _agentThreadId(42)
    let id2 = _agentThreadId(42)
    assert.equal(id1, id2, 'should be deterministic for same user')
  })

  it('different admins have different thread IDs', () => {
    let id1 = _agentThreadId(1)
    let id2 = _agentThreadId(2)
    assert.notEqual(id1, id2, 'should differ for different users')
  })

  it('recordWorkflowResult handles null without crashing', async () => {
    await _recordWorkflowResult(null)
  })

  it('recordWorkflowResult handles invalid result without crashing', async () => {
    await _recordWorkflowResult({
      success: false,
      action: '',
      targetUserId: 0,
      targetUserName: '',
      targetUserEmail: '',
      error: 'test error',
    })
  })

  it('recordWorkflowResult handles valid result without crashing', async () => {
    await _recordWorkflowResult({
      success: true,
      action: 'lock',
      targetUserId: 1,
      targetUserName: 'Test User',
      targetUserEmail: 'test@test.com',
      deletedAppointments: 0,
      auditLogged: true,
    })
  })
})

describe('normalizeUserAction', () => {
  it('passes through canonical English actions', () => {
    assert.equal(normalizeUserAction('cancel'), 'cancel')
    assert.equal(normalizeUserAction('lock'), 'lock')
    assert.equal(normalizeUserAction('unlock'), 'unlock')
    assert.equal(normalizeUserAction('lookup'), 'lookup')
  })

  it('maps German kündigen/stornieren/löschen to cancel', () => {
    assert.equal(normalizeUserAction('kündigen'), 'cancel')
    assert.equal(normalizeUserAction('kündige'), 'cancel')
    assert.equal(normalizeUserAction('Kündigung'), 'cancel')
    assert.equal(normalizeUserAction('kuendigen'), 'cancel')
    assert.equal(normalizeUserAction('gekündigt'), 'cancel')
    assert.equal(normalizeUserAction('stornieren'), 'cancel')
    assert.equal(normalizeUserAction('storniert'), 'cancel')
    assert.equal(normalizeUserAction('löschen'), 'cancel')
    assert.equal(normalizeUserAction('delete'), 'cancel')
  })

  it('maps German sperren/blockieren/deaktivieren to lock', () => {
    assert.equal(normalizeUserAction('sperren'), 'lock')
    assert.equal(normalizeUserAction('sperre'), 'lock')
    assert.equal(normalizeUserAction('Sperrung'), 'lock')
    assert.equal(normalizeUserAction('gesperrt'), 'lock')
    assert.equal(normalizeUserAction('blockieren'), 'lock')
    assert.equal(normalizeUserAction('deaktivieren'), 'lock')
    assert.equal(normalizeUserAction('disable'), 'lock')
  })

  it('maps German entsperren/freischalten/aktivieren to unlock', () => {
    assert.equal(normalizeUserAction('entsperren'), 'unlock')
    assert.equal(normalizeUserAction('entsperrt'), 'unlock')
    assert.equal(normalizeUserAction('freischalten'), 'unlock')
    assert.equal(normalizeUserAction('aktivieren'), 'unlock')
    assert.equal(normalizeUserAction('enable'), 'unlock')
  })

  it('maps German suchen/finden/anzeigen to lookup', () => {
    assert.equal(normalizeUserAction('suchen'), 'lookup')
    assert.equal(normalizeUserAction('finden'), 'lookup')
    assert.equal(normalizeUserAction('anzeigen'), 'lookup')
    assert.equal(normalizeUserAction('show'), 'lookup')
  })

  it('is case- and whitespace-insensitive', () => {
    assert.equal(normalizeUserAction('  SPERREN '), 'lock')
    assert.equal(normalizeUserAction('Kündigen'), 'cancel')
  })

  it('returns the original value for unknown actions', () => {
    assert.equal(normalizeUserAction('bogus'), 'bogus')
    assert.equal(normalizeUserAction(''), '')
  })
})
