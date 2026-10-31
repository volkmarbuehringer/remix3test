import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'
import { DataTableConstraintError, DataTableDatabaseError } from 'remix/data-table'

import { router } from '../../../test-router.ts'
import { initializeAppDatabase } from '../../../db.ts'
import { db } from '../../../db.ts'
import { users } from '../../../data/schema.ts'
import { hashPassword } from '../../../utils/password-hash.ts'
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
