import { describe, it, before, beforeEach, afterEach } from 'remix/test'
import * as assert from 'remix/assert'

import { initializeAppDatabase } from '../../db.ts'
import { pool } from '../../data/test-pool.ts'
import { router } from '../../test-router.ts'
import { createAuthCookieWithCsrf } from '../../test-utils.ts'
import { __setTestChatlogFixtures } from './chatlog/controller.tsx'
import type { ChatThreadPreview, ChatThreadSummary } from '../../utils/mastra-memory.ts'
import type { ChatMessage } from '../../types/chatlog.ts'

const BASE = 'https://remix.run'
const CHATLOG_URL = `${BASE}/admin/chatlog`
const DETAIL_URL = `${BASE}/admin/chatlog/fragments/detail`

function message(role: 'user' | 'assistant', content: string, timestamp: number): ChatMessage {
  return { role, content, timestamp }
}

describe('Admin Chatlog source classification and filter', () => {
  let adminUserId: number
  let adminCookie: string

  before(async () => {
    await initializeAppDatabase()
    let row = await pool.query("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1")
    adminUserId = row.rows[0]?.id as number
    let session = await createAuthCookieWithCsrf()
    adminCookie = session?.cookie ?? ''
  })

  let threads: ChatThreadSummary[]
  let previews: Map<string, ChatThreadPreview>

  beforeEach(() => {
    threads = [
      { id: 'support-thread-1', resourceId: String(adminUserId), createdAt: 3000, updatedAt: 4000 },
      { id: 'customer-thread-1', resourceId: '987654', createdAt: 2000, updatedAt: 2500 },
      { id: 'legacy-thread-1', resourceId: 'route-user', createdAt: 1000, updatedAt: 1500 },
    ]
    previews = new Map([
      [
        'support-thread-1',
        { preview: 'Support-Frage', previewFull: 'User: Support-Frage', messageCount: 4 },
      ],
      [
        'customer-thread-1',
        { preview: 'Kundenfrage', previewFull: 'User: Kundenfrage', messageCount: 2 },
      ],
      ['legacy-thread-1', { preview: '', previewFull: '', messageCount: 0 }],
    ])
    __setTestChatlogFixtures({ threads, previews })
  })

  afterEach(() => {
    __setTestChatlogFixtures(undefined)
  })

  function get(query = ''): Promise<Response> {
    return router.fetch(`${CHATLOG_URL}${query}`, { headers: { Cookie: adminCookie } })
  }

  it('labels each row with its derived source and shows the last-activity column', async () => {
    let response = await get()
    assert.equal(response.status, 200)
    let html = await response.text()

    assert.ok(html.includes('data-chatlog-source-badge="support"'), 'support badge')
    assert.ok(html.includes('data-chatlog-source-badge="customer"'), 'customer badge')
    assert.ok(html.includes('data-chatlog-source-badge="legacy"'), 'legacy badge')
    assert.ok(html.includes('Support-Frage'), 'support preview')
    assert.ok(html.includes('Kundenfrage'), 'customer preview')
    assert.ok(html.includes('Letzte Nachricht'), 'last-activity column')
  })

  it('shows per-source counts in the filter bar', async () => {
    let html = await (await get()).text()
    assert.ok(html.includes('Alle (3)'), 'all count')
    assert.ok(html.includes('Support (1)'), 'support count')
    assert.ok(html.includes('Kunden (1)'), 'customer count')
    assert.ok(html.includes('Sonstige (1)'), 'legacy count')
  })

  it('filters the list to the selected source', async () => {
    let support = await (await get('?source=support')).text()
    assert.ok(support.includes('Support-Frage'), 'support row stays')
    assert.ok(!support.includes('Kundenfrage'), 'customer row is filtered out')
    assert.ok(!support.includes('data-chatlog-source-badge="customer"'), 'no customer badge')

    let customer = await (await get('?source=customer')).text()
    assert.ok(customer.includes('Kundenfrage'))
    assert.ok(!customer.includes('Support-Frage'))
  })

  it('treats an unknown source as all', async () => {
    let html = await (await get('?source=bogus')).text()
    assert.ok(html.includes('Support-Frage'))
    assert.ok(html.includes('Kundenfrage'))
  })

  it('carries the source filter into pagination and transcript links', async () => {
    let html = await (await get('?source=support')).text()
    assert.ok(html.includes('source=support'), 'source filter should reach the grid links')
    assert.ok(
      html.includes('/admin/chatlog/fragments/detail/support-thread-1?source=support'),
      'the transcript frame should carry the filter',
    )
  })

  it('continues an own support conversation from its transcript', async () => {
    __setTestChatlogFixtures({
      threads,
      previews,
      threadLookup: async (threadId) =>
        threadId === 'support-thread-1'
          ? {
              resourceId: String(adminUserId),
              messages: [
                message('user', 'Wie viele Nutzer?', 1000),
                message('assistant', '42.', 2000),
              ],
            }
          : null,
    })

    let response = await router.fetch(`${DETAIL_URL}/support-thread-1`, {
      headers: { Cookie: adminCookie },
    })
    let html = await response.text()

    assert.ok(html.includes('data-chatlog-continue'), 'should offer continue')
    assert.ok(html.includes('Im Chat fortsetzen'), 'should label the control')
    assert.ok(
      html.includes('/admin/support-agent?threadId=support-thread-1'),
      'should link to the support agent with the thread selected',
    )
    assert.ok(html.includes('data-rmx-document'), 'should cross frames as a document navigation')
  })

  it('does not offer continue for a customer or legacy conversation', async () => {
    __setTestChatlogFixtures({
      threads,
      previews,
      threadLookup: async (threadId) =>
        threadId === 'customer-thread-1'
          ? { resourceId: '987654', messages: [message('user', 'Kundenfrage', 1)] }
          : { resourceId: 'route-user', messages: [message('user', 'Alt', 1)] },
    })

    let customer = await (
      await router.fetch(`${DETAIL_URL}/customer-thread-1`, { headers: { Cookie: adminCookie } })
    ).text()
    assert.ok(!customer.includes('data-chatlog-continue'), 'customer thread must stay read-only')

    let legacy = await (
      await router.fetch(`${DETAIL_URL}/legacy-thread-1`, { headers: { Cookie: adminCookie } })
    ).text()
    assert.ok(!legacy.includes('data-chatlog-continue'), 'legacy thread must stay read-only')
  })

  it('keeps the source filter on the transcript dismiss link', async () => {
    __setTestChatlogFixtures({
      threads,
      previews,
      threadLookup: async () => ({
        resourceId: String(adminUserId),
        messages: [message('user', 'Hallo', 1)],
      }),
    })
    let html = await (
      await router.fetch(`${DETAIL_URL}/support-thread-1?source=support`, {
        headers: { Cookie: adminCookie },
      })
    ).text()
    assert.ok(html.includes('href="/admin/chatlog?source=support"'), 'dismiss keeps the filter')
  })
})
