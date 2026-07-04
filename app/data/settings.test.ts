import { describe, it, before, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { db, initializeAppDatabase, pool } from './setup.ts'
import { deleteUser } from './settings.ts'

describe('settings', () => {
  let testUserId: number

  before(async () => {
    await initializeAppDatabase()
  })

  afterEach(async () => {
    if (testUserId) {
      await pool.query('DELETE FROM users WHERE id = $1', [testUserId])
    }
  })

  it('deleteUser returns true for an existing user', async () => {
    let result = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, created_at, updated_at)
       VALUES ('test-del@example.com', 'hash', 'Test User', 'customer', $1, $1)
       RETURNING id`,
      [Date.now()],
    )
    testUserId = result.rows[0].id
    let deleted = await deleteUser(db, testUserId)
    assert.equal(deleted, true)
    let check = await pool.query('SELECT id FROM users WHERE id = $1', [testUserId])
    assert.equal(check.rows.length, 0)
    testUserId = 0
  })

  it('deleteUser returns false for non-existent user', async () => {
    let deleted = await deleteUser(db, 999999999)
    assert.equal(deleted, false)
  })
})
