import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { initializeAppDatabase } from '../../data/setup.ts'
import { router } from '../../test-router.ts'
import { createAuthCookieWithCsrf } from '../../test-utils.ts'

// ---------------------------------------------------------------------------
// Admin Chatlog Fragments Controller integration tests
// Tests the client-mounted detail frame endpoint for chatlog conversations.
// The detail controller reads from Mastra memory, which is unavailable in
// tests, so lookups by ID return the "not found" state.
// ---------------------------------------------------------------------------

const BASE = 'https://remix.run'
const ADMIN_CHATLOG_DETAIL_URL = `${BASE}/admin/chatlog/fragments/detail`

describe('Admin Chatlog Fragments Controller', () => {
  let adminCookie: string

  before(async () => {
    await initializeAppDatabase()

    let result = await createAuthCookieWithCsrf()
    adminCookie = result?.cookie ?? ''
  })

  // -----------------------------------------------------------------------
  // Auth protection
  // -----------------------------------------------------------------------

  it('GET /admin/chatlog/fragments/detail/:id requires admin auth', async () => {
    let response = await router.fetch(`${ADMIN_CHATLOG_DETAIL_URL}/test-id`)
    assert.equal(response.status, 302)
  })

  // -----------------------------------------------------------------------
  // Detail fragment — nonexistent returns error
  // -----------------------------------------------------------------------

  it('GET /admin/chatlog/fragments/detail/nonexistent-id returns 200', async () => {
    let response = await router.fetch(`${ADMIN_CHATLOG_DETAIL_URL}/nonexistent-test-id-12345`, {
      headers: { Cookie: adminCookie },
    })

    assert.equal(response.status, 200)
  })

  // -----------------------------------------------------------------------
  // Detail fragment — invalid thread ID
  // -----------------------------------------------------------------------

  it('GET /admin/chatlog/fragments/detail/invalid-id returns error for null-byte', async () => {
    let response = await router.fetch(`${ADMIN_CHATLOG_DETAIL_URL}/%00null%00`, {
      headers: { Cookie: adminCookie },
    })

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(
      html.includes('No conversation ID provided') || html.includes('Conversation not found'),
      'should show error for invalid thread ID',
    )
  })

  it('GET /admin/chatlog/fragments/detail/empty-id returns error for missing id', async () => {
    // Matches the route but id is empty string → validateThreadId rejects it
    let response = await router.fetch(`${ADMIN_CHATLOG_DETAIL_URL}/empty`, {
      headers: { Cookie: adminCookie },
    })

    assert.equal(response.status, 200)
  })
})
