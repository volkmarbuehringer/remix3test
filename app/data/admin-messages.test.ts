import { describe, it, before, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { db, initializeAppDatabase } from './setup.ts'
import { pool } from './test-pool.ts'
import { listMessages } from './admin-messages.ts'

describe('admin-messages', () => {
  let testUserId: number
  let now: number

  before(async () => {
    await initializeAppDatabase()
  })

  afterEach(async () => {
    if (testUserId) {
      await pool.query('DELETE FROM messages WHERE sender_id = $1', [testUserId])
      await pool.query('DELETE FROM users WHERE id = $1', [testUserId])
    }
  })

  it('listMessages returns messages with sender names', async () => {
    now = Date.now()
    let user = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, created_at, updated_at)
       VALUES ('test-msg@example.com', 'hash', 'Message Sender', 'customer', $1, $1)
       RETURNING id`,
      [now],
    )
    testUserId = user.rows[0].id
    await pool.query(
      `INSERT INTO messages (sender_id, content, created_at) VALUES ($1, 'Hello admin', $2)`,
      [testUserId, now],
    )
    let rows = await listMessages(db, 10, 0)
    assert.ok(rows.length >= 1)
    let match = rows.find((r) => r.content === 'Hello admin')
    assert.ok(match !== undefined)
    assert.equal(match!.sender_name, 'Message Sender')
    assert.equal(match!.sender_id, testUserId)
  })

  it('listMessages returns empty array for large offset', async () => {
    let rows = await listMessages(db, 10, 999999)
    assert.ok(Array.isArray(rows))
    assert.equal(rows.length, 0)
  })
})
