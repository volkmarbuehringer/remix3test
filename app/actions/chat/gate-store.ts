import { db } from '../../db.ts'

type GateType = 'tool_decision' | 'question'
type PendingGateStatus = 'running' | 'suspended'

export type PendingGateRow = {
  userId: number
  runId: string
  threadId: string
  status: PendingGateStatus
  toolCallId: string | null
  toolName: string | null
  args: Record<string, unknown> | null
  gateType: GateType
  suspendPayload: Record<string, unknown> | null
}

type DbRow = {
  user_id: number
  run_id: string
  thread_id: string
  status: PendingGateStatus
  tool_call_id: string | null
  tool_name: string | null
  args: Record<string, unknown> | null
  gate_type: GateType
  suspend_payload: Record<string, unknown> | null
}

function toRow(row: DbRow): PendingGateRow {
  return {
    userId: row.user_id,
    runId: row.run_id,
    threadId: row.thread_id,
    status: row.status,
    toolCallId: row.tool_call_id,
    toolName: row.tool_name,
    args: row.args,
    gateType: row.gate_type,
    suspendPayload: row.suspend_payload,
  }
}

/**
 * Points the customer's pending-gate row at a newly started run.
 *
 * One row per customer (upsert): a new turn supersedes an older suspended gate,
 * so the previous run's later terminal hook cannot clear the newer row (the
 * clear is guarded by run id). Passing a new run resets the gate fields to a
 * running state until a suspension fills them in via `markGateSuspended`.
 */
export async function upsertPendingGate(
  userId: number,
  run: { runId: string; threadId: string },
): Promise<void> {
  let now = Date.now()
  await db.exec(
    `INSERT INTO chat_pending_gates
       (user_id, run_id, thread_id, status, created_at, updated_at)
     VALUES ($1, $2, $3, 'running', $4, $4)
     ON CONFLICT (user_id) DO UPDATE SET
       run_id = EXCLUDED.run_id,
       thread_id = EXCLUDED.thread_id,
       status = EXCLUDED.status,
       tool_call_id = NULL,
       tool_name = NULL,
       args = NULL,
       gate_type = 'tool_decision',
       suspend_payload = NULL,
       updated_at = EXCLUDED.updated_at`,
    [userId, run.runId, run.threadId, now],
  )
}

/**
 * Records the suspended gate payload for a customer's run.
 *
 * Upserts so it works even if the running row was never written (or was
 * superseded): the suspension is what makes the row resumable, so it is the
 * authoritative write.
 */
export async function markGateSuspended(
  userId: number,
  gate: {
    runId: string
    threadId: string
    gateType: GateType
    toolCallId?: string | undefined
    toolName?: string | undefined
    args?: Record<string, unknown> | undefined
    suspendPayload?: Record<string, unknown> | undefined
  },
): Promise<void> {
  let now = Date.now()
  await db.exec(
    `INSERT INTO chat_pending_gates
       (user_id, run_id, thread_id, status, tool_call_id, tool_name, args, gate_type,
        suspend_payload, created_at, updated_at)
     VALUES ($1, $2, $3, 'suspended', $4, $5, $6, $7, $8, $9, $9)
     ON CONFLICT (user_id) DO UPDATE SET
       run_id = EXCLUDED.run_id,
       thread_id = EXCLUDED.thread_id,
       status = 'suspended',
       tool_call_id = EXCLUDED.tool_call_id,
       tool_name = EXCLUDED.tool_name,
       args = EXCLUDED.args,
       gate_type = EXCLUDED.gate_type,
       suspend_payload = EXCLUDED.suspend_payload,
       updated_at = EXCLUDED.updated_at`,
    [
      userId,
      gate.runId,
      gate.threadId,
      gate.toolCallId ?? null,
      gate.toolName ?? null,
      gate.args ? JSON.stringify(gate.args) : null,
      gate.gateType,
      gate.suspendPayload ? JSON.stringify(gate.suspendPayload) : null,
      now,
    ],
  )
}

/** Clears the pointer, guarded by run id so a superseding run's gate survives. */
export async function clearPendingGate(userId: number, runId: string): Promise<void> {
  await db.exec('DELETE FROM chat_pending_gates WHERE user_id = $1 AND run_id = $2', [
    userId,
    runId,
  ])
}

/**
 * Resolves the customer's suspended gate, or null.
 *
 * Joins `chat_runs` so a gate row whose run already settled (its ownership row
 * was cleared) is not surfaced. Status must be 'suspended' — a run that only
 * started has nothing to render yet.
 */
export async function resolvePendingGate(userId: number): Promise<PendingGateRow | null> {
  let result = await db.exec(
    `SELECT g.user_id, g.run_id, g.thread_id, g.status, g.tool_call_id, g.tool_name,
            g.args, g.gate_type, g.suspend_payload
     FROM chat_pending_gates g
     JOIN chat_runs r ON r.run_id = g.run_id AND r.user_id = g.user_id
     WHERE g.user_id = $1 AND g.status = 'suspended'
     ORDER BY g.updated_at DESC
     LIMIT 1`,
    [userId],
  )
  let row = (result.rows ?? [])[0] as DbRow | undefined
  return row ? toRow(row) : null
}
