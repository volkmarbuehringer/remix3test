import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { initializeAppDatabase } from '../../db.ts'
import { createAuthCookieWithCsrf } from '../../test-utils.ts'
import { router } from '../../test-router.ts'

// ---------------------------------------------------------------------------
// Admin Chatlog Controller integration tests
// The controller reads threads from Mastra memory. In the test environment
// no Mastra agent is configured, so the index always returns an empty state.
// ---------------------------------------------------------------------------

const BASE = 'https://remix.run'
const ADMIN_CHATLOG_URL = `${BASE}/admin/chatlog`

describe('Admin Chatlog controller', () => {
  before(async () => {
    await initializeAppDatabase()
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
  // GET /admin/chatlog — basic rendering
  // -----------------------------------------------------------------------

  it('GET /admin/chatlog returns page even when Mastra memory is unavailable', async () => {
    let response = await adminChatlogGet()

    assert.equal(response.status, 200)
    let html = await response.text()

    assert.ok(html.includes('Chat-Konversationen'), 'page title should render')
  })

  // -----------------------------------------------------------------------
  // Auth — unauthenticated access redirects to login
  // -----------------------------------------------------------------------

  it('GET /admin/chatlog redirects to login when not authenticated', async () => {
    let response = await router.fetch(ADMIN_CHATLOG_URL, { redirect: 'manual' })
    assert.equal(response.status, 302)
    assert.ok(
      response.headers.get('Location')?.startsWith('/auth/login'),
      'should redirect to login',
    )
  })

  // -----------------------------------------------------------------------
  // Sidebar should not render lifecycle/demo debug widgets
  // -----------------------------------------------------------------------

  it('does not render lifecycle demo widgets in the admin sidebar', async () => {
    let response = await adminChatlogGet()

    assert.equal(response.status, 200)
    let html = await response.text()

    // Demo/debug widgets were removed from the sidebar (regression guard)
    assert.ok(!html.includes('Persist Counter'), 'should not render Persist Counter label')
    assert.ok(!html.includes('View:'), 'should not render View: label')
  })

  // -----------------------------------------------------------------------
  // Pagination — offset-based (matches the other admin grid routes)
  // -----------------------------------------------------------------------

  it('GET /admin/chatlog?offset=10 renders the requested page number', async () => {
    // With no Mastra memory configured the grid is empty, but a non-zero offset
    // still renders the pagination bar with the computed "Seite N" badge.
    let response = await adminChatlogGet('offset=10')

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('Seite 2'), 'should render the requested page number')
    assert.ok(html.includes('Zurück'), 'should show a back link when offset > 0')
  })

  it('GET /admin/chatlog?offset=-5 falls back to offset 0', async () => {
    let response = await adminChatlogGet('offset=-5')

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(
      html.includes('Noch keine Konversationen gespeichert.'),
      'should fall back to offset 0 and show the empty state',
    )
    assert.ok(!html.includes('Zurück'), 'should not show a back link at offset 0')
  })

  it('GET /admin/chatlog?offset=abc falls back to offset 0', async () => {
    let response = await adminChatlogGet('offset=abc')

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(
      html.includes('Noch keine Konversationen gespeichert.'),
      'should fall back to offset 0 for non-numeric input',
    )
  })

  // -----------------------------------------------------------------------
  // POST /admin/chatlog/:id/delete — destroy
  // -----------------------------------------------------------------------

  it('POST /admin/chatlog/:id/delete redirects after destroy attempt', async () => {
    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    let response = await router.fetch(`https://remix.run/admin/chatlog/test-thread-123/delete`, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: new URLSearchParams({ _csrf: session.csrfToken }),
      redirect: 'manual',
    })

    assert.ok(response.status === 302 || response.status === 303, 'should redirect after destroy')
    let location = response.headers.get('Location')
    assert.ok(
      location === '/admin/chatlog' || location?.startsWith('/admin/chatlog'),
      'should redirect to chatlog index',
    )
  })

  it('POST /admin/chatlog/:id/delete with invalid thread ID still redirects safely', async () => {
    let session = await createAuthCookieWithCsrf()
    assert.ok(session?.cookie, 'Failed to create auth session')

    let response = await router.fetch(`https://remix.run/admin/chatlog/%00null%00/delete`, {
      method: 'POST',
      headers: { Cookie: session.cookie },
      body: new URLSearchParams({ _csrf: session.csrfToken }),
      redirect: 'manual',
    })

    assert.ok(
      response.status === 302 || response.status === 303,
      'should redirect safely for invalid ID',
    )
  })

  it('POST /admin/chatlog/:id/delete without auth returns 403 (CSRF triggers before auth)', async () => {
    let response = await router.fetch('https://remix.run/admin/chatlog/some-thread/delete', {
      method: 'POST',
      redirect: 'manual',
    })

    // CSRF middleware fires before auth middleware for POST requests
    assert.equal(response.status, 403)
  })

  // -----------------------------------------------------------------------
  // hasMore — hidden when page is empty
  // -----------------------------------------------------------------------

  it('GET /admin/chatlog does not render pagination controls when empty', async () => {
    let response = await adminChatlogGet()

    assert.equal(response.status, 200)
    let html = await response.text()

    assert.ok(!html.includes('Zurück'), 'should not show back link with empty state')
    assert.ok(!html.includes('Weiter'), 'should not show forward link with empty state')
  })
})
