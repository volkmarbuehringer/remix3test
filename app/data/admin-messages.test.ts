import { describe, it, before, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { db, initializeAppDatabase } from '../db.ts'
import { pool } from '../../test/pool.ts'
import { listMessages, countMessages } from './admin-messages.ts'

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

  it('listMessages keeps messages whose sender account was deleted', async () => {
    now = Date.now()
    let user = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, created_at, updated_at)
       VALUES ('test-orphan-msg@example.com', 'hash', 'Orphan Sender', 'customer', $1, $1)
       RETURNING id`,
      [now],
    )
    let orphanUserId = user.rows[0].id
    let inserted = await pool.query(
      `INSERT INTO messages (sender_id, content, created_at)
       VALUES ($1, 'Orphaned Content Token', $2) RETURNING id`,
      [orphanUserId, now],
    )
    let messageId = inserted.rows[0].id

    // Deleting the user nulls messages.sender_id (ON DELETE SET NULL); the row
    // must still be listed, with a null sender name, rather than dropped by an
    // inner join.
    await pool.query('DELETE FROM users WHERE id = $1', [orphanUserId])

    try {
      let rows = await listMessages(db, 10, 0, 'Orphaned Content Token')
      let match = rows.find((r) => r.content === 'Orphaned Content Token')
      assert.ok(match !== undefined, 'orphaned message must still be listed')
      assert.equal(match!.sender_name, null)
      assert.equal(match!.sender_id, null)
    } finally {
      await pool.query('DELETE FROM messages WHERE id = $1', [messageId])
    }
  })

  it('listMessages returns empty array for large offset', async () => {
    let rows = await listMessages(db, 10, 999999)
    assert.ok(Array.isArray(rows))
    assert.equal(rows.length, 0)
  })

  it('listMessages filters by message content (case-insensitive)', async () => {
    now = Date.now()
    let user = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, created_at, updated_at)
       VALUES ('test-filter@example.com', 'hash', 'Filter Sender', 'customer', $1, $1)
       RETURNING id`,
      [now],
    )
    testUserId = user.rows[0].id
    await pool.query(
      `INSERT INTO messages (sender_id, content, created_at) VALUES ($1, 'Alpha Unique Token', $2)`,
      [testUserId, now],
    )
    await pool.query(
      `INSERT INTO messages (sender_id, content, created_at) VALUES ($1, 'Beta Different', $2)`,
      [testUserId, now + 1],
    )
    let rows = await listMessages(db, 10, 0, 'alpha unique')
    assert.ok(
      rows.some((r) => r.content === 'Alpha Unique Token'),
      'matching message should be returned',
    )
    assert.ok(
      !rows.some((r) => r.content === 'Beta Different'),
      'non-matching message should be excluded',
    )
  })

  it('countMessages totals all rows and narrows by the same filter as the list', async () => {
    now = Date.now()
    let user = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, created_at, updated_at)
       VALUES ('test-count@example.com', 'hash', 'Count Sender', 'customer', $1, $1)
       RETURNING id`,
      [now],
    )
    testUserId = user.rows[0].id
    await pool.query(
      `INSERT INTO messages (sender_id, content, created_at) VALUES ($1, 'COUNT_TOKEN_ONE', $2)`,
      [testUserId, now],
    )
    await pool.query(
      `INSERT INTO messages (sender_id, content, created_at) VALUES ($1, 'COUNT_TOKEN_TWO', $2)`,
      [testUserId, now + 1],
    )

    assert.equal(await countMessages(db, 'COUNT_TOKEN_'), 2)
    assert.equal(await countMessages(db, 'COUNT_TOKEN_ONE'), 1)
    assert.equal(await countMessages(db, 'no_such_message_token'), 0)
    // The sender-name half of the shared OR filter must count too.
    assert.equal(await countMessages(db, 'Count Sender'), 2)
  })

  it('countMessages treats LIKE wildcards as literal characters', async () => {
    now = Date.now()
    let user = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, created_at, updated_at)
       VALUES ('test-count-wildcard@example.com', 'hash', 'Wildcard Sender', 'customer', $1, $1)
       RETURNING id`,
      [now],
    )
    testUserId = user.rows[0].id
    await pool.query(
      `INSERT INTO messages (sender_id, content, created_at) VALUES ($1, '100% literal match', $2)`,
      [testUserId, now],
    )

    assert.equal(await countMessages(db, '100%'), 1, 'the percent sign must not match everything')
    assert.equal(await countMessages(db, '100_'), 0, 'the underscore must not match one character')
  })
})
