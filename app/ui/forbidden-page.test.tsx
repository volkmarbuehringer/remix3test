import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../test-router.ts'
import { initializeAppDatabase } from '../data/setup.ts'
import { createAuthCookieWithCsrfForUser } from '../test-utils.ts'

// ---------------------------------------------------------------------------
// ForbiddenPage integration tests
// Tests the 403 page rendered by requireAdmin() for non-admin users.
// ---------------------------------------------------------------------------

const BASE = 'https://remix.run'
const ADMIN_URL = `${BASE}/admin/messages`

describe('ForbiddenPage', () => {
  let userCookie: string

  before(async () => {
    await initializeAppDatabase()

    let result = await createAuthCookieWithCsrfForUser('user@newapp.com')
    userCookie = result?.cookie ?? ''
  })

  // -----------------------------------------------------------------------
  // Status code
  // -----------------------------------------------------------------------

  it('returns 403 for non-admin users', async () => {
    // Arrange & Act: non-admin user accesses admin endpoint
    let response = await router.fetch(ADMIN_URL, {
      headers: { Cookie: userCookie },
    })

    // Assert
    assert.equal(response.status, 403)
  })

  // -----------------------------------------------------------------------
  // Page content — title
  // -----------------------------------------------------------------------

  it('renders "403" as the page title', async () => {
    // Arrange & Act
    let response = await router.fetch(ADMIN_URL, {
      headers: { Cookie: userCookie },
    })
    let html = await response.text()

    // Assert
    assert.ok(html.includes('403'), 'should render "403" as the title')
  })

  // -----------------------------------------------------------------------
  // Default message
  // -----------------------------------------------------------------------

  it('uses the default access denied message when no message prop is provided', async () => {
    // Arrange & Act
    let response = await router.fetch(ADMIN_URL, {
      headers: { Cookie: userCookie },
    })
    let html = await response.text()

    // Assert
    assert.ok(
      html.includes("You don't have admin access to this section."),
      'should show the default forbidden message',
    )
  })

  // -----------------------------------------------------------------------
  // Link back to home
  // -----------------------------------------------------------------------

  it('includes a link back to "/"', async () => {
    // Arrange & Act
    let response = await router.fetch(ADMIN_URL, {
      headers: { Cookie: userCookie },
    })
    let html = await response.text()

    // Assert
    assert.ok(
      html.includes('Back to Home'),
      'should include a link with "Back to Home" text',
    )
    assert.ok(
      html.includes('href="/"'),
      'should include a link pointing to "/"',
    )
  })

  // -----------------------------------------------------------------------
  // Fragment rendering — no full document wrapper
  // -----------------------------------------------------------------------

  it('does NOT render a full HTML document (no <html> tag)', async () => {
    // Arrange & Act
    let response = await router.fetch(ADMIN_URL, {
      headers: { Cookie: userCookie },
    })
    let html = await response.text()

    // Assert
    assert.ok(
      !html.includes('<html'),
      'should not contain <html> tag since it is rendered as a fragment',
    )
  })

  // -----------------------------------------------------------------------
  // Theme tokens — component renders without crashing
  // -----------------------------------------------------------------------

  it('renders without error when using css() mixins and theme tokens', async () => {
    // Arrange & Act: if the component renders without throwing,
    // the css() mixins and theme tokens are applied correctly
    let response = await router.fetch(ADMIN_URL, {
      headers: { Cookie: userCookie },
    })

    // Assert: response is a valid 403
    assert.equal(response.status, 403)
    let html = await response.text()
    // The page should have actual content (not empty)
    assert.ok(html.length > 0, 'response body should not be empty')
  })
})
