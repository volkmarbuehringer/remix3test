import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'
import { createSession } from 'remix/session'

import { renderVerwaltungPage } from './verwaltung-layout.tsx'
import { router } from '../test-router.ts'
import { sessionCookie, sessionStorage } from '../middleware/session.ts'
import { initializeAppDatabase } from '../db.ts'
import { pool } from '../data/test-pool.ts'
import { routes } from '../routes.ts'

const OFFERINGS_URL = 'https://remix.run' + routes.verwaltung.offerings.index.href()

// ---------------------------------------------------------------------------
// Verwaltung fragment flash banner
// Verwaltung pages render as frame fragments through renderVerwaltungPage (not
// the top-level Layout), so PRG flash messages must render in the fragment path.
// ---------------------------------------------------------------------------

describe('Verwaltung fragment — flash messages', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  it('exports renderVerwaltungPage', () => {
    assert.equal(typeof renderVerwaltungPage, 'function')
  })

  async function createAdminSessionWith(
    key: 'error' | 'success',
    value: string,
  ): Promise<string> {
    let result = await pool.query('SELECT id, token_version FROM users WHERE email = $1', [
      'admin@newapp.com',
    ])
    let row = result.rows[0] as { id: number; token_version: number } | undefined
    if (!row) throw new Error('Admin user not found in DB')

    let session = createSession()
    session.set('auth', { userId: row.id, tv: row.token_version ?? 1 })
    session.flash(key, value)
    session.set('_csrf', 'test-csrf-token-for-shell-flash')

    let sid = await sessionStorage.save(session)
    if (!sid) throw new Error('sessionStorage.save returned null')
    let cookieHeader = await sessionCookie.serialize(sid)
    return cookieHeader.split(';')[0]
  }

  it('renders error flash banner in the verwaltung fragment path', async () => {
    let cookie = await createAdminSessionWith('error', 'Verwaltung error banner message')

    let response = await router.fetch(OFFERINGS_URL, {
      headers: { Cookie: cookie, 'X-Remix-Target': 'admin-content' },
    })

    assert.equal(response.status, 200, 'should render the verwaltung fragment')
    let html = await response.text()
    assert.ok(
      html.includes('Verwaltung error banner message'),
      'error flash should render in the verwaltung fragment',
    )
  })

  it('renders success flash banner in the verwaltung fragment path', async () => {
    let cookie = await createAdminSessionWith('success', 'Verwaltung success banner message')

    let response = await router.fetch(OFFERINGS_URL, {
      headers: { Cookie: cookie, 'X-Remix-Target': 'admin-content' },
    })

    assert.equal(response.status, 200, 'should render the verwaltung fragment')
    let html = await response.text()
    assert.ok(
      html.includes('Verwaltung success banner message'),
      'success flash should render in the verwaltung fragment',
    )
  })
})
