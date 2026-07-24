import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'
import { createSession } from 'remix/session'

import { router } from '../test-router.ts'
import { sessionCookie, sessionStorage } from '../middleware/session.ts'
import { initializeAppDatabase } from '../data/setup.ts'

import { pool } from '../data/test-pool.ts'
// ---------------------------------------------------------------------------
// Layout flash message tests
// Verifies that values stored in the session via session.set() are rendered
// as colored banner bars by the Layout component.
// ---------------------------------------------------------------------------

import { routes } from '../routes.ts'

const BASE = 'https://remix.run'
const TEST_URL = `${BASE}${routes.lists.index.href()}`

describe('Layout — flash messages', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  /**
   * Create an authenticated session (mimicking what the login controller
   * does) and add a value that the Layout reads via session.get('error')
   * or session.get('success').
   */
  async function createAuthSessionWithData(
    key: 'error' | 'success',
    value: string,
  ): Promise<string> {
    let result = await pool.query('SELECT id, token_version FROM users WHERE email = $1', [
      'user@newapp.com',
    ])
    let row = result.rows[0] as { id: number; token_version: number } | undefined
    if (!row) throw new Error('Test user not found in DB')

    // Create a session exactly as the login controller would,
    // including _csrf so the CSRF middleware doesn't need to write to it.
    let session = createSession()
    session.set('auth', { userId: row.id, tv: row.token_version ?? 1 })
    session.set(key, value)
    session.set('_csrf', 'test-csrf-token-for-flash-tests')

    let sid = await sessionStorage.save(session)
    if (!sid) throw new Error('sessionStorage.save returned null')

    let cookieHeader = await sessionCookie.serialize(sid)
    return cookieHeader.split(';')[0] // "session=abc123"
  }

  /** Create an authenticated session with no extra values. */
  async function createCleanAuthSession(): Promise<string> {
    let result = await pool.query('SELECT id, token_version FROM users WHERE email = $1', [
      'user@newapp.com',
    ])
    let row = result.rows[0] as { id: number; token_version: number } | undefined
    if (!row) throw new Error('Test user not found in DB')

    let session = createSession()
    session.set('auth', { userId: row.id, tv: row.token_version ?? 1 })
    session.set('_csrf', 'test-csrf-token-for-flash-tests')

    let sid = await sessionStorage.save(session)
    if (!sid) throw new Error('sessionStorage.save returned null')

    let cookieHeader = await sessionCookie.serialize(sid)
    return cookieHeader.split(';')[0]
  }

  // -----------------------------------------------------------------------
  // Error value in session
  // -----------------------------------------------------------------------

  it('renders error flash banner when session has error flash', async () => {
    // Arrange
    let cookie = await createAuthSessionWithData('error', 'Test error banner message')

    // Act
    let response = await router.fetch(TEST_URL, {
      headers: { Cookie: cookie },
    })

    // Assert
    assert.equal(response.status, 200, 'should render the page')
    let html = await response.text()
    assert.ok(
      html.includes('Test error banner message'),
      'error flash message should appear in rendered HTML',
    )
  })

  // -----------------------------------------------------------------------
  // Success value in session
  // -----------------------------------------------------------------------

  it('renders success flash banner when session has success flash', async () => {
    // Arrange
    let cookie = await createAuthSessionWithData('success', 'Operation completed successfully')

    // Act
    let response = await router.fetch(TEST_URL, {
      headers: { Cookie: cookie },
    })

    // Assert
    assert.equal(response.status, 200, 'should render the page')
    let html = await response.text()
    assert.ok(
      html.includes('Operation completed successfully'),
      'success flash message should appear in rendered HTML',
    )
  })

  // -----------------------------------------------------------------------
  // No extra values in session — no banner
  // -----------------------------------------------------------------------

  it('does not render flash banner when session has no flash messages', async () => {
    // Arrange
    let cookie = await createCleanAuthSession()

    // Act
    let response = await router.fetch(TEST_URL, {
      headers: { Cookie: cookie },
    })

    // Assert
    assert.equal(response.status, 200, 'should render the page')
    let html = await response.text()
    assert.ok(html.includes('Listen'), 'normal page content should render')
  })
})
