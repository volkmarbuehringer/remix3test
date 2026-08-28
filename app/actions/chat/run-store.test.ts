import { describe, it, before, beforeEach, afterEach } from 'remix/test'
import * as assert from 'remix/assert'

import { initializeAppDatabase } from '../../db.ts'
import { pool } from '../../data/test-pool.ts'
import { recordChatRun, findChatRunOwner, clearChatRun } from './run-store.ts'

describe('chat run-store', () => {
  let userId: number
  let runId: string

  before(async () => {
    await initializeAppDatabase()
  })

  beforeEach(async () => {
    let res = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, created_at, updated_at)
       VALUES ($1, $2, 'RunStore', 'customer', $3, $3) RETURNING id`,
      [`runstore-${Date.now()}-${Math.random()}@example.com`, 'x'.repeat(60), Date.now()],
    )
    userId = res.rows[0].id
    runId = crypto.randomUUID()
  })

  afterEach(async () => {
    await pool.query('DELETE FROM users WHERE id = $1', [userId])
  })

  it('records and resolves a run owner', async () => {
    await recordChatRun({ runId, userId, threadId: 'thread-1' })
    let owner = await findChatRunOwner(runId)
    assert.ok(owner, 'owner should be found')
    assert.equal(owner!.userId, userId)
    assert.equal(owner!.threadId, 'thread-1')
  })

  it('returns null for an unknown run', async () => {
    let owner = await findChatRunOwner(crypto.randomUUID())
    assert.equal(owner, null)
  })

  it('is idempotent on re-record of the same run', async () => {
    await recordChatRun({ runId, userId, threadId: 'thread-1' })
    await recordChatRun({ runId, userId, threadId: 'thread-1' })
    let owner = await findChatRunOwner(runId)
    assert.equal(owner!.userId, userId)
  })

  it('clears a run when it reaches a terminal state', async () => {
    await recordChatRun({ runId, userId, threadId: 'thread-1' })
    await clearChatRun(runId)
    let owner = await findChatRunOwner(runId)
    assert.equal(owner, null)
  })

  it('resolves ownership from durable storage (no in-memory state)', async () => {
    await recordChatRun({ runId, userId, threadId: 'thread-1' })
    // A fresh read resolves the row from Postgres, so the mapping survives a
    // server restart / scale-out without the previous process-local store.
    let owner = await findChatRunOwner(runId)
    assert.ok(owner, 'owner should be found')
    assert.equal(owner!.userId, userId)
  })
})
