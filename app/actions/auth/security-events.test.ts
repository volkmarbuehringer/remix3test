import { describe, it, before, after } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../../test-router.ts'
import { createCsrfSession } from '../../../test/utils.ts'
import { routes } from '../../routes.ts'
import { initializeAppDatabase } from '../../db.ts'
import { pool } from '../../../test/pool.ts'
import { hashPassword } from '../../utils/password-hash.ts'
import { __resetLoginRateLimits } from '../../utils/login-rate-limit.ts'

const BASE = 'https://remix.run'
const TEST_PREFIX = `sec-evt-${Date.now()}-`
const PASSWORD = 'secEvtPass123!'

// ---------------------------------------------------------------------------
// M6: authentication activity must land in the durable security_events sink,
// not just stdout. These tests drive the real login endpoints and assert the
// rows are written with the right event_type and user attribution.
// ---------------------------------------------------------------------------

describe('security events (M6)', () => {
  let email = `${TEST_PREFIX}user@example.com`
  let userId: number

  before(async () => {
    await initializeAppDatabase()
    __resetLoginRateLimits()
    let inserted = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, email_verified, created_at)
       VALUES ($1, $2, $3, $4, 1, $5) RETURNING id`,
      [email, await hashPassword(PASSWORD), 'Security Event User', 'customer', Date.now()],
    )
    userId = inserted.rows[0].id as number
  })

  after(async () => {
    await pool.query('DELETE FROM security_events WHERE email = $1', [email])
    await pool.query('DELETE FROM api_tokens WHERE user_id = $1', [userId])
    await pool.query('DELETE FROM users WHERE id = $1', [userId])
    __resetLoginRateLimits()
  })

  async function eventTypes(): Promise<string[]> {
    let rows = await pool.query(
      'SELECT event_type FROM security_events WHERE email = $1 ORDER BY id',
      [email],
    )
    return rows.rows.map((r) => r.event_type as string)
  }

  it('records a successful browser login', async () => {
    let { cookie, csrfToken } = await createCsrfSession(`${BASE}${routes.auth.login.index.href()}`)
    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: new URLSearchParams({ email, password: PASSWORD, _csrf: csrfToken }),
      redirect: 'manual',
    })
    assert.equal(response.status, 303)

    let rows = await pool.query(
      "SELECT user_id FROM security_events WHERE email = $1 AND event_type = 'login_success'",
      [email],
    )
    assert.equal(rows.rows.length, 1, 'exactly one login_success event')
    assert.equal(rows.rows[0].user_id, userId, 'the event must attribute the user')
  })

  it('records a failed browser login', async () => {
    let { cookie, csrfToken } = await createCsrfSession(`${BASE}${routes.auth.login.index.href()}`)
    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: new URLSearchParams({ email, password: 'wrong-password', _csrf: csrfToken }),
      redirect: 'manual',
    })
    assert.equal(response.status, 401)

    let types = await eventTypes()
    assert.ok(types.includes('login_failed'), 'a failed login must be recorded')
  })

  it('records API login success and bearer-token issuance', async () => {
    let response = await router.fetch(`${BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD }),
    })
    assert.equal(response.status, 200)

    let types = await eventTypes()
    assert.ok(types.includes('api_login_success'), 'API login success must be recorded')
    assert.ok(types.includes('api_token_issued'), 'token issuance must be recorded')
  })

  it('records API logout token revocation', async () => {
    let login = await router.fetch(`${BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD }),
    })
    assert.equal(login.status, 200)
    let { token } = await login.json()

    let logout = await router.fetch(`${BASE}/api/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    assert.equal(logout.status, 200)

    let rows = await pool.query(
      "SELECT details FROM security_events WHERE user_id = $1 AND event_type = 'api_token_revoked'",
      [userId],
    )
    assert.ok(rows.rows.length >= 1, 'token revocation must be recorded')
  })
})
