import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { initializeAppDatabase } from '../../data/setup.ts'
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

  // -----------------------------------------------------------------------
  // Pagination
  // -----------------------------------------------------------------------

  it('GET /admin/chatlog?page=2 renders the requested page number', async () => {
    let response = await adminChatlogGet('page=2')

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('Seite 2'), 'should render the requested page number')
  })

  it('GET /admin/chatlog?page=-1 falls back to page 1', async () => {
    let response = await adminChatlogGet('page=-1')

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('Seite 1'), 'should fall back to page 1 for negative input')
  })

  it('GET /admin/chatlog?page=abc falls back to page 1', async () => {
    let response = await adminChatlogGet('page=abc')

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('Seite 1'), 'should fall back to page 1 for non-numeric input')
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
    assert.ok(location === '/admin/chatlog' || location?.startsWith('/admin/chatlog'), 'should redirect to chatlog index')
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

    assert.ok(response.status === 302 || response.status === 303, 'should redirect safely for invalid ID')
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

    assert.ok(!html.includes('← Zurück'), 'should not show back link with empty state')
    assert.ok(!html.includes('Weiter →'), 'should not show forward link with empty state')
  })
})

