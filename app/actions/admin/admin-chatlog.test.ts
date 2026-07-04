import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { db, initializeAppDatabase } from '../../data/setup.ts'
import { sql } from 'remix/data-table'
import { createAuthCookieWithCsrf } from '../../test-utils.ts'
import { router } from '../../test-router.ts'

// ---------------------------------------------------------------------------
// Admin Chatlog Controller integration tests
// Tests the type query parameter filtering on /admin/chatlog.
// Requires a running PostgreSQL database seeded with demo users.
// ---------------------------------------------------------------------------

const BASE = 'https://remix.run'
const ADMIN_CHATLOG_URL = `${BASE}/admin/chatlog`

describe('Admin Chatlog controller', () => {
  before(async () => {
    await initializeAppDatabase()

    let now = Date.now()

    // Chat-only conversation: no toolCalls on any message
    let chatId = `admin-chatlog-test-chat-${now}`
    await db.exec(sql`
      INSERT INTO chatlog (id, conversation, created_at, updated_at)
      VALUES (${chatId}, ${JSON.stringify([
        { role: 'user', content: 'Hello', timestamp: now },
        { role: 'assistant', content: 'Hi there!', timestamp: now },
      ])}::jsonb, ${now}, ${now})
    `)

    // Agent conversation: the assistant message has toolCalls
    let agentId = `admin-chatlog-test-agent-${now}`
    await db.exec(sql`
      INSERT INTO chatlog (id, conversation, created_at, updated_at)
      VALUES (${agentId}, ${JSON.stringify([
        { role: 'user', content: 'Book a flight', timestamp: now },
        {
          role: 'assistant',
          content: 'Let me search for flights',
          timestamp: now,
          toolCalls: [
            { name: 'searchFlights', input: { from: 'NYC', to: 'LAX' }, timestamp: now },
          ],
        },
      ])}::jsonb, ${now}, ${now})
    `)
  })

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  /** Authenticate as admin and return the session cookie value. */
  async function getAdminSessionCookie(): Promise<string> {
    let result = await createAuthCookieWithCsrf()
    return result?.cookie ?? ''
  }

  /** Make an authenticated GET request to the admin chatlog endpoint. */
  async function adminChatlogGet(queryString?: string): Promise<Response> {
    let session = await getAdminSessionCookie()
    let url = queryString ? `${ADMIN_CHATLOG_URL}?${queryString}` : ADMIN_CHATLOG_URL
    return await router.fetch(url, {
      headers: { Cookie: session },
    })
  }

  // -----------------------------------------------------------------------
  // GET /admin/chatlog — no type filter (existing behavior preserved)
  // -----------------------------------------------------------------------

  it('GET /admin/chatlog returns all conversations when no type param', async () => {
    let response = await adminChatlogGet()

    assert.equal(response.status, 200)
    let html = await response.text()

    // Both test conversations should be present
    assert.ok(html.includes('admin-chatlog-test-chat-'), 'should include chat conversation')
    assert.ok(html.includes('admin-chatlog-test-agent-'), 'should include agent conversation')

    // No type indicator label should be rendered
    assert.ok(!html.includes('Showing:'), 'should not display type filter label')
  })

  // -----------------------------------------------------------------------
  // GET /admin/chatlog?type=chat — chat-only filter
  // -----------------------------------------------------------------------

  it('GET /admin/chatlog?type=chat returns only conversations without toolCalls', async () => {
    let response = await adminChatlogGet('type=chat')

    assert.equal(response.status, 200)
    let html = await response.text()

    // Type indicator label should show "Chat conversations"
    assert.ok(html.includes('Angezeigt:'), 'should display type filter label')
    assert.ok(html.includes('Chat-Konversationen'), 'should indicate chat filter')

    // Should include the chat conversation
    assert.ok(html.includes('admin-chatlog-test-chat-'), 'should include chat conversation')

    // Should NOT include the agent conversation
    assert.ok(
      !html.includes('admin-chatlog-test-agent-'),
      'should NOT include agent conversation',
    )
  })

  // -----------------------------------------------------------------------
  // GET /admin/chatlog?type=agent — agent-only filter
  // -----------------------------------------------------------------------

  it('GET /admin/chatlog?type=agent returns only conversations with toolCalls', async () => {
    let response = await adminChatlogGet('type=agent')

    assert.equal(response.status, 200)
    let html = await response.text()

    // Type indicator label should show "Agent conversations"
    assert.ok(html.includes('Angezeigt:'), 'should display type filter label')
    assert.ok(html.includes('Agent-Konversationen'), 'should indicate agent filter')

    // Should include the agent conversation
    assert.ok(html.includes('admin-chatlog-test-agent-'), 'should include agent conversation')

    // Should NOT include the chat conversation
    assert.ok(
      !html.includes('admin-chatlog-test-chat-'),
      'should NOT include chat conversation',
    )
  })

  // -----------------------------------------------------------------------
  // GET /admin/chatlog?type=invalid — invalid type ignored
  // -----------------------------------------------------------------------

  it('GET /admin/chatlog?type=invalid ignores invalid type and returns all conversations', async () => {
    let response = await adminChatlogGet('type=invalid')

    assert.equal(response.status, 200)
    let html = await response.text()

    // Both test conversations should be present (fallback to all)
    assert.ok(html.includes('admin-chatlog-test-chat-'), 'should include chat conversation')
    assert.ok(html.includes('admin-chatlog-test-agent-'), 'should include agent conversation')

    // No type indicator label should be rendered
    assert.ok(!html.includes('Showing:'), 'should not display type filter label')
  })

  // -----------------------------------------------------------------------
  // Root reload lifecycle demo entries rendered in sidebar
  // -----------------------------------------------------------------------

  it('renders AdminViewToggle lifecycle demo in admin sidebar', async () => {
    let response = await adminChatlogGet()

    assert.equal(response.status, 200)
    let html = await response.text()

    // AdminViewToggle renders view buttons with "Dashboard"/"Chatlog" labels
    assert.ok(html.includes('View:'), 'should render View: label')
    assert.ok(html.includes('Dashboard'), 'should render Dashboard toggle button')
    assert.ok(html.includes('Chatlog'), 'should render Chatlog toggle button')
  })

  it('renders PersistentAdminCounter lifecycle demo in admin sidebar', async () => {
    let response = await adminChatlogGet()

    assert.equal(response.status, 200)
    let html = await response.text()

    // PersistentAdminCounter renders counter UI
    assert.ok(html.includes('Persist Counter'), 'should render Persist Counter label')
  })
})
