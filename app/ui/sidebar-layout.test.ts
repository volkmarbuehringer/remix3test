import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'
import { createSession } from 'remix/session'

import { createSidebarLayout } from './sidebar-layout.tsx'
import { renderAdminPage, AdminLayout } from './admin-layout.tsx'
import { router } from '../test-router.ts'
import { sessionCookie, sessionStorage } from '../middleware/session.ts'
import { initializeAppDatabase } from '../db.ts'
import { pool } from '../data/test-pool.ts'
import { routes } from '../routes.ts'

// ---------------------------------------------------------------------------
// Factory contract tests
// Verifies that createSidebarLayout returns the expected shape.
// ---------------------------------------------------------------------------

describe('createSidebarLayout', () => {
  it('returns renderPage, Layout, and isFrameRequest', () => {
    let result = createSidebarLayout({
      frameTarget: 'test-content',
      navGroups: [],
      navIcon: () => null,
      headerIcon: null,
      headerLabel: 'Test',
    })

    assert.equal(typeof result.renderPage, 'function')
    assert.ok(result.Layout, 'Layout should be defined')
    assert.equal(typeof result.isFrameRequest, 'function')
  })

  it('uses headerLabel in config', () => {
    let result = createSidebarLayout({
      frameTarget: 'section-content',
      navGroups: [],
      navIcon: () => null,
      headerIcon: null,
      headerLabel: 'Custom Label',
    })

    // The headerLabel is used internally by the Layout component
    // Verify the factory doesn't throw and returns the expected shape
    assert.equal(typeof result.renderPage, 'function')
  })

  it('accepts nav groups with items', () => {
    type TestId = 'item1' | 'item2'

    let result = createSidebarLayout<TestId>({
      frameTarget: 'test-content',
      navGroups: [
        {
          items: [
            { id: 'item1', label: 'Item 1', href: '/item1' },
            { id: 'item2', label: 'Item 2', href: '/item2' },
          ],
        },
      ],
      navIcon: () => null,
      headerIcon: null,
      headerLabel: 'Test',
    })

    assert.equal(typeof result.renderPage, 'function')
    assert.ok(result.Layout)
  })

  it('accepts nav groups with mixed iframeNav settings', () => {
    type TestId = 'frame' | 'document'

    let result = createSidebarLayout<TestId>({
      frameTarget: 'test-content',
      navGroups: [
        {
          items: [
            { id: 'frame', label: 'Frame Nav', href: '/frame' },
            { id: 'document', label: 'Document Nav', href: '/doc', iframeNav: false },
          ],
        },
      ],
      navIcon: () => null,
      headerIcon: null,
      headerLabel: 'Test',
    })

    assert.equal(typeof result.renderPage, 'function')
  })

  it('accepts sidebarExtras', () => {
    let result = createSidebarLayout({
      frameTarget: 'test-content',
      navGroups: [],
      navIcon: () => null,
      headerIcon: null,
      headerLabel: 'Test',
      sidebarExtras: null,
    })

    assert.equal(typeof result.renderPage, 'function')
    assert.ok(result.Layout)
  })
})

// ---------------------------------------------------------------------------
// Admin layout export consistency
// Verifies that admin-layout.tsx still exports the expected API.
// ---------------------------------------------------------------------------

describe('Admin layout exports', () => {
  it('exports renderAdminPage as a function', () => {
    assert.equal(typeof renderAdminPage, 'function')
  })

  it('exports AdminLayout component', () => {
    assert.ok(AdminLayout, 'AdminLayout should be defined')
  })
})

// ---------------------------------------------------------------------------
// Admin sidebar shell flash banner
// Admin pages render as frame fragments through the sidebar shell (not the
// top-level Layout), so PRG flash messages must render here.
// ---------------------------------------------------------------------------

const ADMIN_USERS_URL = 'https://remix.run' + routes.admin.users.index.href()

describe('Admin sidebar shell — flash messages', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  async function createAdminSessionWith(key: 'error' | 'success', value: string): Promise<string> {
    let result = await pool.query('SELECT id, token_version FROM users WHERE email = $1', [
      'admin@newapp.com',
    ])
    let row = result.rows[0] as { id: number; token_version: number } | undefined
    if (!row) throw new Error('Admin user not found in DB')

    let session = createSession()
    session.set('auth', { userId: row.id, tv: row.token_version ?? 1 })
    session.set(key, value)
    session.set('_csrf', 'test-csrf-token-for-shell-flash')

    let sid = await sessionStorage.save(session)
    if (!sid) throw new Error('sessionStorage.save returned null')
    let cookieHeader = await sessionCookie.serialize(sid)
    return cookieHeader.split(';')[0]
  }

  it('renders error flash banner in the admin sidebar shell', async () => {
    let cookie = await createAdminSessionWith('error', 'Shell error banner message')

    let response = await router.fetch(ADMIN_USERS_URL, {
      headers: { Cookie: cookie, 'X-Remix-Target': 'admin-content' },
    })

    assert.equal(response.status, 200, 'should render the admin fragment')
    let html = await response.text()
    assert.ok(
      html.includes('Shell error banner message'),
      'error flash should render in the admin sidebar shell',
    )
  })

  it('renders success flash banner in the admin sidebar shell', async () => {
    let cookie = await createAdminSessionWith('success', 'Shell success banner message')

    let response = await router.fetch(ADMIN_USERS_URL, {
      headers: { Cookie: cookie, 'X-Remix-Target': 'admin-content' },
    })

    assert.equal(response.status, 200, 'should render the admin fragment')
    let html = await response.text()
    assert.ok(
      html.includes('Shell success banner message'),
      'success flash should render in the admin sidebar shell',
    )
  })
})
