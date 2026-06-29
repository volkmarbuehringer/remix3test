import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../../../router.ts'
import { initializeAppDatabase, pool, db } from '../../../data/setup.ts'
import { generateApiToken, hashToken } from '../../../utils/api-token.ts'

const BASE = 'https://remix.run'

describe('API Logout controller', () => {
  let authToken: string

  before(async () => {
    await initializeAppDatabase()

    let loginResponse = await router.fetch(`${BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@newapp.com',
        password: process.env.SEED_ADMIN_PASSWORD || 'admin123',
      }),
    })
    assert.equal(loginResponse.status, 200, 'login must succeed to test logout')
    let body = await loginResponse.json()
    authToken = body.token
  })

  it('POST /api/logout returns success for valid token', async () => {
    let response = await router.fetch(`${BASE}/api/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
    })
    assert.equal(response.status, 200)
    let body = await response.json()
    assert.equal(body.success, true)
  })

  it('POST /api/logout revokes token (subsequent use fails)', async () => {
    let response = await router.fetch(`${BASE}/api/lists`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    assert.equal(response.status, 401)
  })

  it('POST /api/logout returns 401 without Authorization header', async () => {
    let response = await router.fetch(`${BASE}/api/logout`, {
      method: 'POST',
    })
    assert.equal(response.status, 401)
  })

  it('POST /api/logout returns 401 for invalid token', async () => {
    let response = await router.fetch(`${BASE}/api/logout`, {
      method: 'POST',
      headers: { Authorization: 'Bearer invalid-token-xyz' },
    })
    assert.equal(response.status, 401)
  })

  it('expired token returns 401 from middleware', async () => {
    let rawToken = generateApiToken()
    let tokenHash = hashToken(rawToken)
    await pool.query(
      `INSERT INTO api_tokens (user_id, token_hash, created_at, expires_at)
       VALUES (1, $1, 0, 0)`,
      [tokenHash],
    )

    let response = await router.fetch(`${BASE}/api/lists`, {
      headers: { Authorization: `Bearer ${rawToken}` },
    })
    assert.equal(response.status, 401)
  })
})
