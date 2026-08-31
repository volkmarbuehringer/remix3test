import { describe, it, before, beforeEach, afterEach } from 'remix/test'
import * as assert from 'remix/assert'

import { initializeAppDatabase } from '../../db.ts'
import { pool } from '../../data/test-pool.ts'
import {
  upsertPendingGate,
  markGateSuspended,
  clearPendingGate,
  resolvePendingGate,
} from './run-store.ts'

describe('support-agent run-store', () => {
  let adminUserId: number
  let runId: string
  let threadId: string

  before(async () => {
    await initializeAppDatabase()
  })

  beforeEach(async () => {
    let res = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, created_at, updated_at)
       VALUES ($1, $2, 'SupportStore', 'admin', $3, $3) RETURNING id`,
      [`supportstore-${Date.now()}-${Math.random()}@example.com`, 'x'.repeat(60), Date.now()],
    )
    adminUserId = res.rows[0].id
    runId = crypto.randomUUID()
    threadId = 'thread-' + crypto.randomUUID()
  })

  afterEach(async () => {
    await pool.query('DELETE FROM users WHERE id = $1', [adminUserId])
  })

  it('records and resolves a pending gate for an admin', async () => {
    await upsertPendingGate(adminUserId, { runId, threadId })
    let row = await resolvePendingGate(adminUserId, runId)
    assert.ok(row, 'row should be found')
    assert.equal(row!.runId, runId)
    assert.equal(row!.threadId, threadId)
    assert.equal(row!.status, 'running')
    assert.equal(row!.suspendPayload, null)
  })

  it('returns null for an unknown admin', async () => {
    await upsertPendingGate(adminUserId, { runId, threadId })
    let row = await resolvePendingGate(adminUserId + 999999, runId)
    assert.equal(row, null)
  })

  it('returns null when the run id does not match the admin row', async () => {
    await upsertPendingGate(adminUserId, { runId, threadId })
    let row = await resolvePendingGate(adminUserId, crypto.randomUUID())
    assert.equal(row, null)
  })

  it('a new run supersedes a previous pending one', async () => {
    await upsertPendingGate(adminUserId, { runId, threadId })
    let newRunId = crypto.randomUUID()
    await upsertPendingGate(adminUserId, { runId: newRunId, threadId })
    let row = await resolvePendingGate(adminUserId)
    assert.ok(row, 'row should be found')
    assert.equal(row!.runId, newRunId)
  })

  it('records a suspended gate payload', async () => {
    await upsertPendingGate(adminUserId, { runId, threadId })
    await markGateSuspended(adminUserId, {
      runId,
      threadId,
      gateType: 'tool_decision',
      toolCallId: 'call-1',
      toolName: 'get_admin_stats',
      args: { filter: 'week' },
      suspendPayload: { question: 'Proceed?', options: [{ label: 'Yes' }] },
    })
    let row = await resolvePendingGate(adminUserId, runId)
    assert.ok(row, 'row should be found')
    assert.equal(row!.status, 'suspended')
    assert.equal(row!.toolCallId, 'call-1')
    assert.equal(row!.toolName, 'get_admin_stats')
    assert.equal(row!.gateType, 'tool_decision')
    assert.deepEqual(row!.args, { filter: 'week' })
    assert.deepEqual(row!.suspendPayload, { question: 'Proceed?', options: [{ label: 'Yes' }] })
  })

  it('a question gate records gate_type question', async () => {
    await upsertPendingGate(adminUserId, { runId, threadId })
    await markGateSuspended(adminUserId, {
      runId,
      threadId,
      gateType: 'question',
      suspendPayload: { question: 'Which user?', options: [{ label: 'A' }, { label: 'B' }] },
    })
    let row = await resolvePendingGate(adminUserId, runId)
    assert.ok(row, 'row should be found')
    assert.equal(row!.gateType, 'question')
    assert.equal(row!.toolCallId, null)
  })

  it('clear is guarded by run id so it cannot clear a newer run', async () => {
    await upsertPendingGate(adminUserId, { runId, threadId })
    let newRunId = crypto.randomUUID()
    await upsertPendingGate(adminUserId, { runId: newRunId, threadId })
    // The old run finishing must not clear the newer run's row.
    await clearPendingGate(adminUserId, runId)
    let row = await resolvePendingGate(adminUserId, newRunId)
    assert.ok(row, 'new run row should remain')
    assert.equal(row!.runId, newRunId)
  })

  it('clears a pending gate to a terminal state', async () => {
    await upsertPendingGate(adminUserId, { runId, threadId })
    await clearPendingGate(adminUserId, runId)
    let row = await resolvePendingGate(adminUserId, runId)
    assert.equal(row, null)
  })
})
