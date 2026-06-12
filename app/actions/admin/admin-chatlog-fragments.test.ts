import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { db, initializeAppDatabase } from '../../data/setup.ts'
import { sql } from 'remix/data-table'
import { router } from '../../router.ts'
import { createAuthCookieWithCsrf } from '../../test-utils.ts'

// ---------------------------------------------------------------------------
// Admin Chatlog Fragments Controller integration tests
// Tests the client-mounted detail frame endpoint for chatlog conversations.
// Requires a running PostgreSQL database seeded with demo users.
// ---------------------------------------------------------------------------

const BASE = 'https://remix.run'
const ADMIN_CHATLOG_DETAIL_URL = `${BASE}/admin/chatlog/fragments/detail`

describe('Admin Chatlog Fragments Controller', () => {
  let adminCookie: string
  let testConversationId: string

  before(async () => {
    await initializeAppDatabase()

    let result = await createAuthCookieWithCsrf()
    adminCookie = result?.cookie ?? ''

    // Create a test conversation we can look up by ID
    let now = Date.now()
    testConversationId = `admin-chatlog-fragments-test-${now}`
    await db.exec(sql`
      INSERT INTO chatlog (id, conversation, created_at, updated_at)
      VALUES (${testConversationId}, ${JSON.stringify([
        { role: 'user', content: 'Test message content', timestamp: now },
        { role: 'assistant', content: 'Test response', timestamp: now },
      ])}::jsonb, ${now}, ${now})
    `)
  })

  // -----------------------------------------------------------------------
  // Auth protection
  // -----------------------------------------------------------------------

  it('GET /admin/chatlog/fragments/detail/:id requires admin auth', async () => {
    let response = await router.fetch(`${ADMIN_CHATLOG_DETAIL_URL}/test-id`)
    assert.equal(response.status, 302)
  })

  // -----------------------------------------------------------------------
  // Detail fragment — valid conversation
  // -----------------------------------------------------------------------

  it('GET /admin/chatlog/fragments/detail/:id returns conversation messages', async () => {
    let response = await router.fetch(`${ADMIN_CHATLOG_DETAIL_URL}/${testConversationId}`, {
      headers: { Cookie: adminCookie },
    })

    assert.equal(response.status, 200)
    let html = await response.text()

    // Should contain the conversation messages
    assert.ok(html.includes('Test message content'), 'should render user message')
    assert.ok(html.includes('Test response'), 'should render assistant response')
    // Heading includes truncated ID with "Conversation #" prefix
    assert.ok(html.includes('Conversation'), 'should have conversation heading')
  })

  it('GET /admin/chatlog/fragments/detail/:id shows message roles', async () => {
    let response = await router.fetch(`${ADMIN_CHATLOG_DETAIL_URL}/${testConversationId}`, {
      headers: { Cookie: adminCookie },
    })

    let html = await response.text()

    // Roles should be visible in the detail view
    assert.ok(html.includes('User') || html.includes('user'), 'should show user role')
    assert.ok(html.includes('Assistant') || html.includes('assistant'), 'should show assistant role')
  })

  // -----------------------------------------------------------------------
  // Detail fragment — missing / nonexistent
  // -----------------------------------------------------------------------

  it('GET /admin/chatlog/fragments/detail/nonexistent-id returns error', async () => {
    let response = await router.fetch(`${ADMIN_CHATLOG_DETAIL_URL}/nonexistent-test-id-12345`, {
      headers: { Cookie: adminCookie },
    })

    assert.equal(response.status, 200)
    let html = await response.text()

    // Should handle nonexistent conversation gracefully
    assert.ok(
      html.includes('not found') || html.includes('error'),
      'should show error for nonexistent conversation',
    )
  })

  // -----------------------------------------------------------------------
  // Fragment renders detail content
  // -----------------------------------------------------------------------

  it('renders conversation content directly', async () => {
    let response = await router.fetch(`${ADMIN_CHATLOG_DETAIL_URL}/${testConversationId}`, {
      headers: { Cookie: adminCookie },
    })

    let html = await response.text()
    // Should render conversation messages without admin sidebar
    assert.ok(html.includes('Test message content'), 'should contain message content')
  })
})
