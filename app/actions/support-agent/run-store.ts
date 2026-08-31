import { db } from '../../db.ts'

export type GateType = 'tool_decision' | 'question'
export type PendingGateStatus = 'running' | 'suspended'

export type PendingGateRow = {
  adminUserId: number
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
  admin_user_id: number
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
    adminUserId: row.admin_user_id,
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
 * Durable per-admin pointer to the support agent's currently pending gate.
 *
 * The Mastra run is the source of truth; this row is a pointer so a suspended
 * tool approval or ask_user question can be re-surfaced after a reload, a
 * browser change, or a server restart without an in-memory stream store (a
 * PostgresStoreVNext agent-run-status query is not exposed, so the indexed
 * row is the durable record). One row per admin: a new run supersedes a
 * previous pending one, and the previous run's terminal hook is guarded by run
 * id in clearPendingGate so it cannot clear the newer run's row.
 */
export async function upsertPendingGate(
  adminUserId: number,
  run: { runId: string; threadId: string },
): Promise<void> {
  let now = Date.now()
  await db.exec(
    `INSERT INTO support_agent_pending_gates
       (admin_user_id, run_id, thread_id, status, created_at, updated_at)
     VALUES ($1, $2, $3, 'running', $4, $4)
     ON CONFLICT (admin_user_id) DO UPDATE SET
       run_id = EXCLUDED.run_id,
       thread_id = EXCLUDED.thread_id,
       status = EXCLUDED.status,
       tool_call_id = NULL,
       tool_name = NULL,
       args = NULL,
       gate_type = 'tool_decision',
       suspend_payload = NULL,
       updated_at = EXCLUDED.updated_at`,
    [adminUserId, run.runId, run.threadId, now],
  )
}

/** Records the suspended gate payload for the running row (matched by run id). */
export async function markGateSuspended(
  adminUserId: number,
  gate: {
    runId: string
    threadId: string
    gateType: GateType
    toolCallId?: string
    toolName?: string
    args?: Record<string, unknown>
    suspendPayload?: Record<string, unknown>
  },
): Promise<void> {
  await db.exec(
    `UPDATE support_agent_pending_gates
     SET status = 'suspended',
         tool_call_id = $1,
         tool_name = $2,
         args = $3,
         gate_type = $4,
         suspend_payload = $5,
         updated_at = $6
     WHERE admin_user_id = $7 AND run_id = $8`,
    [
      gate.toolCallId ?? null,
      gate.toolName ?? null,
      gate.args ? JSON.stringify(gate.args) : null,
      gate.gateType,
      gate.suspendPayload ? JSON.stringify(gate.suspendPayload) : null,
      Date.now(),
      adminUserId,
      gate.runId,
    ],
  )
}

/**
 * Clears the pending gate pointer. Guarded by run id: if the admin started a
 * newer run, the older run's completion must not clear the newer row.
 */
export async function clearPendingGate(adminUserId: number, runId: string): Promise<void> {
  await db.exec(
    'DELETE FROM support_agent_pending_gates WHERE admin_user_id = $1 AND run_id = $2',
    [adminUserId, runId],
  )
}

/**
 * Resolves the admin's pending gate. When a run id is given it must match the
 * admin's row; otherwise the most recently updated row for that admin is
 * returned (the reconnect surface).
 */
export async function resolvePendingGate(
  adminUserId: number,
  runId?: string,
): Promise<PendingGateRow | null> {
  let result = runId
    ? await db.exec(
        `SELECT admin_user_id, run_id, thread_id, status, tool_call_id, tool_name,
                args, gate_type, suspend_payload
         FROM support_agent_pending_gates WHERE admin_user_id = $1 AND run_id = $2`,
        [adminUserId, runId],
      )
    : await db.exec(
        `SELECT admin_user_id, run_id, thread_id, status, tool_call_id, tool_name,
                args, gate_type, suspend_payload
         FROM support_agent_pending_gates WHERE admin_user_id = $1
         ORDER BY updated_at DESC LIMIT 1`,
        [adminUserId],
      )
  let row = (result.rows ?? [])[0] as DbRow | undefined
  return row ? toRow(row) : null
}
