import { describe, it, before, after } from 'remix/test'
import * as assert from 'remix/assert'
import { DataTableConstraintError, DataTableDatabaseError } from 'remix/data-table'

import { router } from '../../../test-router.ts'
import { initializeAppDatabase } from '../../../db.ts'
import { db } from '../../../db.ts'
import { users } from '../../../data/schema.ts'
import { hashPassword } from '../../../utils/password-hash.ts'
import { __resetLoginRateLimits } from '../../../utils/login-rate-limit.ts'
import { routes } from '../../../routes.ts'
import { createCsrfSession } from '../../../../test/utils.ts'
import { isTokenHashCollision } from './controller.tsx'

const BASE = 'https://remix.run'

describe('API Login controller', () => {
  before(async () => {
    await initializeAppDatabase()

    // Create an unverified user for testing the 403 path
    let existing = await db.findOne(users, { where: { email: 'unverified@test.com' } })
    if (!existing) {
      await db.create(users, {
        email: 'unverified@test.com',
        password_hash: await hashPassword('test-password-123'),
        name: 'Unverified User',
        email_verified: 0,
      })
    }
  })

  it('POST /api/login returns token for valid credentials', async () => {
    let response = await router.fetch(`${BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@newapp.com',
        password: process.env.SEED_ADMIN_PASSWORD!,
      }),
    })
    assert.equal(response.status, 200)
    let body = await response.json()
    assert.equal(typeof body.token, 'string', 'should return a token string')
    assert.ok(body.token.startsWith('tok_'), 'token should start with tok_')
  })

  it('POST /api/login returns 401 for invalid password', async () => {
    let response = await router.fetch(`${BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@newapp.com',
        password: 'wrong-password',
      }),
    })
    assert.equal(response.status, 401)
    let body = await response.json()
    assert.equal(body.error, 'Invalid email or password')
  })

  it('POST /api/login returns 401 for non-existent user', async () => {
    let response = await router.fetch(`${BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nobody@example.com',
        password: 'some-password',
      }),
    })
    assert.equal(response.status, 401)
    let body = await response.json()
    assert.equal(body.error, 'Invalid email or password')
  })

  it('POST /api/login returns 400 for missing fields', async () => {
    let response = await router.fetch(`${BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '' }),
    })
    assert.equal(response.status, 400)
    let body = await response.json()
    assert.equal(body.error, 'Email and password are required')
  })

  it('POST /api/login returns 400 for invalid JSON', async () => {
    let response = await router.fetch(`${BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    })
    assert.equal(response.status, 400)
  })

  it('POST /api/login returns 403 for unverified email', async () => {
    let response = await router.fetch(`${BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'unverified@test.com',
        password: 'test-password-123',
      }),
    })
    assert.equal(response.status, 403)
    let body = await response.json()
    assert.equal(body.error, 'Email not verified')
  })

  it('classifies a wrapped 23505 unique violation as a token-hash collision', () => {
    let cause = Object.assign(
      new Error('duplicate key value violates unique constraint "api_tokens_token_hash_key"'),
      { code: '23505' },
    )
    let wrapped = new DataTableDatabaseError('Database query failed', { cause })

    assert.ok(isTokenHashCollision(wrapped), 'the wrapped 23505 must trigger the retry path')
    assert.ok(!isTokenHashCollision(new DataTableConstraintError('unrelated')))
    assert.ok(!isTokenHashCollision(new Error('connection reset')))
  })
})

// ---------------------------------------------------------------------------
// H1: /api/login and /auth/login must share ONE escalating account lockout.
// The API endpoint used to have its own 10/60s limiter with no long-tier
// lockout, and its attempt() counted successful logins too.
// ---------------------------------------------------------------------------

describe('API login shares the browser account lockout (H1)', () => {
  let LOCK_EMAIL = `api-lock-${Date.now()}@example.com`

  before(async () => {
    await initializeAppDatabase()
    __resetLoginRateLimits()
  })

  after(() => {
    __resetLoginRateLimits()
  })

  async function postApiLogin(email: string, password: string) {
    return router.fetch(`${BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
  }

  it('applies the escalating short-tier lockout after 5 failed attempts', async () => {
    for (let i = 0; i < 5; i++) {
      let response = await postApiLogin(LOCK_EMAIL, 'wrong-password')
      assert.equal(response.status, 401, `failure ${i + 1} should be rejected, not throttled`)
    }

    let blocked = await postApiLogin(LOCK_EMAIL, 'wrong-password')
    assert.equal(blocked.status, 429, 'the 6th attempt must be rate-limited')
    assert.ok(blocked.headers.get('Retry-After'), 'a 429 must carry Retry-After')
    let body = await blocked.json()
    assert.equal(body.error, 'Too many requests. Try again later.')
  })

  it('blocks the browser login with the same lockout state', async () => {
    // The browser form schema only trims; the API lowercases. The shared
    // limiter normalizes both, so a differently-cased email cannot split the
    // budget across two keys.
    let mixedCaseEmail = LOCK_EMAIL.replace('api-lock', 'Api-Lock')
    let { cookie, csrfToken } = await createCsrfSession(`${BASE}${routes.auth.login.index.href()}`)
    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: new URLSearchParams({
        email: mixedCaseEmail,
        password: 'wrong-password',
        _csrf: csrfToken,
      }),
      redirect: 'manual',
    })

    assert.equal(response.status, 429, 'the browser login must see the API-induced lockout')
    let html = await response.text()
    assert.ok(html.includes('Too many attempts'), 'the browser surfaces the lockout message')
  })

  it('counts only failures and clears stale failures on success', async () => {
    __resetLoginRateLimits()
    let password = process.env.SEED_ADMIN_PASSWORD!

    // Four wrong passwords must not trigger a lockout, but they do consume
    // the shared failure budget.
    for (let i = 0; i < 4; i++) {
      let response = await postApiLogin('admin@newapp.com', 'wrong-password')
      assert.equal(response.status, 401, `failed login ${i + 1} should be rejected`)
    }

    // The old limiter used attempt() on every request (10/60s), so 11 valid
    // logins would have produced a 429. Successes must not consume the budget.
    for (let i = 0; i < 11; i++) {
      let response = await postApiLogin('admin@newapp.com', password)
      assert.equal(response.status, 200, `successful login ${i + 1} must not be throttled`)
    }

    // A successful login resets the per-email failures: another four wrong
    // passwords are still rejected with 401 rather than 429.
    for (let i = 0; i < 4; i++) {
      let response = await postApiLogin('admin@newapp.com', 'wrong-password')
      assert.equal(response.status, 401, 'the reset leaves a full fresh budget')
    }
  })
})
