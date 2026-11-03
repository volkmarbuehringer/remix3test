import { describe, it, before, beforeEach, afterEach } from 'remix/test'
import * as assert from 'remix/assert'

import { initializeAppDatabase } from '../../db.ts'
import { pool } from '../../../test/pool.ts'
import { router } from '../../test-router.ts'
import { createAuthCookieWithCsrf } from '../../../test/utils.ts'
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
  let adminCsrfToken: string

  before(async () => {
    await initializeAppDatabase()
    let row = await pool.query("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1")
    adminUserId = row.rows[0]?.id as number
    let session = await createAuthCookieWithCsrf()
    adminCookie = session?.cookie ?? ''
    adminCsrfToken = session?.csrfToken ?? ''
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

  it('renders the row actions as a shared, hover-revealed control group', async () => {
    let html = await (await get()).text()

    assert.ok(html.includes('data-chatlog-actions="true"'), 'row actions should share one control')
    assert.ok(html.includes('data-row-actions'), 'the cluster needs the reveal hook')
    assert.ok(html.includes('aria-label="Detail anzeigen"'), 'detail action should be labelled')
    assert.ok(html.includes('aria-label="Löschen"'), 'delete action should be labelled')
    assert.ok(html.includes('data-delete-form'), 'delete form must be rendered in the row')
  })

  it('labels every cell for the stacked card layout', async () => {
    let html = await (await get()).text()

    for (let label of [
      'Konversation',
      'Quelle',
      'Nachrichten',
      'Erstellt',
      'Letzte Nachricht',
      'Aktionen',
    ]) {
      assert.ok(html.includes(`data-label="${label}"`), `missing data-label "${label}"`)
    }
  })

  it('offers to clear the filter when the filtered list is empty', async () => {
    __setTestChatlogFixtures({
      threads: [
        { id: 'support-only', resourceId: String(adminUserId), createdAt: 1, updatedAt: 2 },
      ],
      previews: new Map([
        ['support-only', { preview: 'Nur Support', previewFull: 'Nur Support', messageCount: 1 }],
      ]),
    })

    let html = await (await get('?source=customer')).text()

    assert.ok(html.includes('Keine Konversationen in „Kunden“.'), 'filter-aware empty state')
    assert.ok(html.includes('Alle anzeigen'), 'offers to clear the filter')
    assert.ok(html.includes('href="/admin/chatlog"'), 'links back to the unfiltered list')
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

  it('offers adoption instead of continue for a customer or legacy conversation', async () => {
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
    assert.ok(
      !customer.includes('data-chatlog-continue'),
      'customer thread must not resume directly',
    )
    assert.ok(customer.includes('data-chatlog-claim'), 'customer thread should be adoptable')
    assert.ok(
      customer.includes('Übernehmen &amp; fortsetzen'),
      'adoption control should be labelled',
    )
    assert.ok(
      customer.includes('action="/admin/chatlog/customer-thread-1/claim"'),
      'adoption posts to the claim route',
    )
    assert.ok(
      customer.includes('name="_csrf"'),
      'the adoption form needs a CSRF token for the POST',
    )

    let legacy = await (
      await router.fetch(`${DETAIL_URL}/legacy-thread-1`, { headers: { Cookie: adminCookie } })
    ).text()
    assert.ok(!legacy.includes('data-chatlog-continue'), 'legacy thread must not resume directly')
    assert.ok(legacy.includes('data-chatlog-claim'), 'legacy thread should be adoptable')
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

  // ── Adoption (Übernehmen & fortsetzen) ─────────────────────────

  function claim(threadId: string, body: Record<string, string> = {}) {
    return router.fetch(`${BASE}/admin/chatlog/${threadId}/claim`, {
      method: 'POST',
      headers: { Cookie: adminCookie },
      body: new URLSearchParams({ _csrf: adminCsrfToken, ...body }),
      redirect: 'manual',
    })
  }

  it('adopts a customer conversation into the admin support scope', async () => {
    let reassignments: Array<{ threadId: string; resourceId: string }> = []
    __setTestChatlogFixtures({
      threads,
      previews,
      threadLookup: async (threadId) =>
        threadId === 'customer-thread-1'
          ? { resourceId: '987654', messages: [message('user', 'Kundenfrage', 1)] }
          : null,
      reassign: async (threadId, resourceId) => {
        reassignments.push({ threadId, resourceId })
      },
    })

    let response = await claim('customer-thread-1', { _return: '/admin/chatlog?source=customer' })

    assert.equal(response.status, 303)
    assert.equal(
      response.headers.get('Location'),
      '/admin/support-agent?threadId=customer-thread-1',
      'should open the adopted conversation in the support agent',
    )
    assert.deepEqual(reassignments, [
      { threadId: 'customer-thread-1', resourceId: String(adminUserId) },
    ])
  })

  it('adopts a legacy conversation too', async () => {
    let reassignments: Array<{ threadId: string; resourceId: string }> = []
    __setTestChatlogFixtures({
      threads,
      previews,
      threadLookup: async () => ({ resourceId: 'route-user', messages: [] }),
      reassign: async (threadId, resourceId) => {
        reassignments.push({ threadId, resourceId })
      },
    })

    let response = await claim('legacy-thread-1')

    assert.equal(response.status, 303)
    assert.equal(response.headers.get('Location'), '/admin/support-agent?threadId=legacy-thread-1')
    assert.equal(reassignments.length, 1, 'legacy thread should be reassigned')
  })

  it('does not reassign a conversation already owned by the admin', async () => {
    let reassignments: string[] = []
    __setTestChatlogFixtures({
      threads,
      previews,
      threadLookup: async () => ({
        resourceId: String(adminUserId),
        messages: [message('user', 'Support-Frage', 1)],
      }),
      reassign: async (threadId) => {
        reassignments.push(threadId)
      },
    })

    let response = await claim('support-thread-1')

    assert.equal(response.status, 303)
    assert.equal(response.headers.get('Location'), '/admin/support-agent?threadId=support-thread-1')
    assert.equal(reassignments.length, 0, 'an owned thread must not be reassigned again')
  })

  it('refuses to adopt another admin support thread', async () => {
    let otherAdminEmail = `test-chatlog-other-admin-${Date.now()}@example.com`
    let otherAdminId: number | null = null
    let reassignments: string[] = []
    try {
      let inserted = await pool.query(
        `INSERT INTO users (email, password_hash, name, role, email_verified, token_version, created_at)
         VALUES ($1, 'x', 'Other Admin', 'admin', 1, 1, $2) RETURNING id`,
        [otherAdminEmail, Date.now()],
      )
      otherAdminId = inserted.rows[0].id as number

      __setTestChatlogFixtures({
        threads,
        previews,
        threadLookup: async () => ({ resourceId: String(otherAdminId), messages: [] }),
        reassign: async (threadId) => {
          reassignments.push(threadId)
        },
      })

      let response = await claim('other-admin-thread', { _return: '/admin/chatlog?offset=10' })

      assert.equal(response.status, 303)
      assert.equal(
        response.headers.get('Location'),
        '/admin/chatlog?offset=10',
        'a refused adoption returns to the list it came from',
      )
      assert.equal(reassignments.length, 0, 'another admin thread must never be reassigned')

      let follow = await router.fetch(`${BASE}/admin/chatlog?offset=10`, {
        headers: { Cookie: adminCookie },
      })
      assert.ok(
        (await follow.text()).includes('gehört zu einem anderen Admin'),
        'the refusal should be surfaced as a flash',
      )
    } finally {
      if (otherAdminId !== null) await pool.query('DELETE FROM users WHERE id = $1', [otherAdminId])
    }
  })

  it('does not adopt a conversation that still has a live run', async () => {
    let runId = `test-chatlog-run-${Date.now()}`
    let reassignments: string[] = []
    await pool.query(
      `INSERT INTO chat_runs (run_id, user_id, thread_id, created_at) VALUES ($1, $2, $3, $4)`,
      [runId, adminUserId, 'customer-thread-1', Date.now()],
    )
    try {
      __setTestChatlogFixtures({
        threads,
        previews,
        threadLookup: async () => ({ resourceId: '987654', messages: [] }),
        reassign: async (threadId) => {
          reassignments.push(threadId)
        },
      })

      let html = await (
        await router.fetch(`${DETAIL_URL}/customer-thread-1`, { headers: { Cookie: adminCookie } })
      ).text()
      assert.ok(!html.includes('data-chatlog-claim'), 'a live conversation must not be adoptable')
      assert.ok(!html.includes('data-chatlog-continue'), 'a live customer thread cannot continue')

      let response = await claim('customer-thread-1')
      assert.equal(response.status, 303)
      assert.equal(response.headers.get('Location'), '/admin/chatlog')
      assert.equal(reassignments.length, 0, 'a live run must keep its thread owner')

      let follow = await router.fetch(`${BASE}/admin/chatlog`, { headers: { Cookie: adminCookie } })
      assert.ok(
        (await follow.text()).includes('wird gerade verwendet'),
        'the refusal should be surfaced as a flash',
      )
    } finally {
      await pool.query('DELETE FROM chat_runs WHERE run_id = $1', [runId])
    }
  })

  it('redirects safely when the thread does not exist', async () => {
    let reassignments: string[] = []
    __setTestChatlogFixtures({
      threads,
      previews,
      threadLookup: async () => null,
      reassign: async (threadId) => {
        reassignments.push(threadId)
      },
    })

    let response = await claim('missing-thread', { _return: '/admin/chatlog?source=legacy' })

    assert.equal(response.status, 303)
    assert.equal(response.headers.get('Location'), '/admin/chatlog?source=legacy')
    assert.equal(reassignments.length, 0, 'a missing thread must not be reassigned')
  })

  it('ignores an off-site return URL', async () => {
    __setTestChatlogFixtures({
      threads,
      previews,
      threadLookup: async () => null,
    })

    let response = await claim('missing-thread', { _return: '//evil.example.com/steal' })

    assert.equal(response.status, 303)
    assert.equal(response.headers.get('Location'), '/admin/chatlog')
  })
})
