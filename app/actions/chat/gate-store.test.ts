import { describe, it, before, beforeEach, afterEach } from 'remix/test'
import * as assert from 'remix/assert'

import { initializeAppDatabase } from '../../db.ts'
import { pool } from '../../data/test-pool.ts'
import { recordChatRun } from './run-store.ts'
import {
  upsertPendingGate,
  markGateSuspended,
  clearPendingGate,
  resolvePendingGate,
} from './gate-store.ts'

describe('chat pending gate store', () => {
  let userId: number
  let runId: string

  before(async () => {
    await initializeAppDatabase()
  })

  beforeEach(async () => {
    let res = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, created_at, updated_at)
       VALUES ($1, $2, 'GateStore', 'customer', $3, $3) RETURNING id`,
      [`gatestore-${Date.now()}-${Math.random()}@example.com`, 'x'.repeat(60), Date.now()],
    )
    userId = res.rows[0].id
    runId = crypto.randomUUID()
  })

  afterEach(async () => {
    // Deleting the user cascades to both pointer tables.
    await pool.query('DELETE FROM users WHERE id = $1', [userId])
  })

  it('does not surface a gate whose run has no ownership row', async () => {
    await markGateSuspended(userId, {
      runId,
      threadId: 't',
      gateType: 'question',
      suspendPayload: { question: 'Welcher Termin?' },
    })
    // The join with chat_runs is what keeps a settled run's stale gate hidden.
    assert.equal(await resolvePendingGate(userId), null)
  })

  it('resolves a suspended question gate for a live run', async () => {
    await recordChatRun({ runId, userId, threadId: 't' })
    await upsertPendingGate(userId, { runId, threadId: 't' })
    await markGateSuspended(userId, {
      runId,
      threadId: 't',
      gateType: 'question',
      toolCallId: 'call-1',
      toolName: 'ask_user',
      suspendPayload: {
        question: 'Welcher Termin?',
        options: null,
        selectionMode: 'single_select',
      },
    })

    let gate = await resolvePendingGate(userId)
    assert.ok(gate, 'suspended gate should resolve')
    assert.equal(gate!.runId, runId)
    assert.equal(gate!.gateType, 'question')
    assert.equal(gate!.toolCallId, 'call-1')
    assert.equal(gate!.toolName, 'ask_user')
    assert.deepEqual(gate!.suspendPayload, {
      question: 'Welcher Termin?',
      options: null,
      selectionMode: 'single_select',
    })
  })

  it('does not surface a running row that has not suspended', async () => {
    await recordChatRun({ runId, userId, threadId: 't' })
    await upsertPendingGate(userId, { runId, threadId: 't' })
    assert.equal(await resolvePendingGate(userId), null)
  })

  it('clears only the matching run, so a newer gate survives', async () => {
    let otherRun = crypto.randomUUID()
    await recordChatRun({ runId, userId, threadId: 't' })
    await markGateSuspended(userId, {
      runId,
      threadId: 't',
      gateType: 'question',
      suspendPayload: { question: 'x' },
    })

    await clearPendingGate(userId, otherRun)
    assert.ok(await resolvePendingGate(userId), 'a non-matching clear must not remove the gate')

    await clearPendingGate(userId, runId)
    assert.equal(await resolvePendingGate(userId), null)
  })

  it('resolves a specific run when a run id is supplied', async () => {
    let otherRun = crypto.randomUUID()
    await recordChatRun({ runId, userId, threadId: 't' })
    await upsertPendingGate(userId, { runId, threadId: 't' })
    await markGateSuspended(userId, {
      runId,
      threadId: 't',
      gateType: 'question',
      suspendPayload: { question: 'x' },
    })

    let match = await resolvePendingGate(userId, runId)
    assert.ok(match, 'the matching run should resolve')
    assert.equal(match!.runId, runId)
    assert.equal(
      await resolvePendingGate(userId, otherRun),
      null,
      'a non-matching run must not resolve to the newest gate',
    )
  })

  it('a new run supersedes the previous gate', async () => {
    let newRun = crypto.randomUUID()
    await recordChatRun({ runId, userId, threadId: 't' })
    await markGateSuspended(userId, {
      runId,
      threadId: 't',
      gateType: 'question',
      suspendPayload: { question: 'alt' },
    })

    await recordChatRun({ runId: newRun, userId, threadId: 't' })
    await upsertPendingGate(userId, { runId: newRun, threadId: 't' })
    // The previous gate is superseded the moment the new run starts.
    assert.equal(await resolvePendingGate(userId), null)

    await markGateSuspended(userId, {
      runId: newRun,
      threadId: 't',
      gateType: 'tool_decision',
      toolCallId: 'c2',
      toolName: 'cancel_booking',
      args: { appointmentId: 5 },
    })
    let gate = await resolvePendingGate(userId)
    assert.ok(gate)
    assert.equal(gate!.runId, newRun)
    assert.equal(gate!.gateType, 'tool_decision')
    assert.deepEqual(gate!.args, { appointmentId: 5 })
  })
})
