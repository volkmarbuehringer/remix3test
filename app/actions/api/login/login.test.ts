import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../../../router.ts'
import { initializeAppDatabase } from '../../../data/setup.ts'
import { db } from '../../../data/setup.ts'
import { users } from '../../../data/schema.ts'
import { hashPassword } from '../../../utils/password-hash.ts'

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
})
