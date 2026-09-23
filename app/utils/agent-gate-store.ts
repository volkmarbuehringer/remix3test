import { db } from '../db.ts'

export type GateType = 'tool_decision' | 'question'
export type PendingGateStatus = 'running' | 'suspended'

/** A durable per-actor pointer to a suspended agent run. */
export interface PendingGateRow {
  ownerId: number
  runId: string
  threadId: string
  status: PendingGateStatus
  toolCallId: string | null
  toolName: string | null
  args: Record<string, unknown> | null
  gateType: GateType
  suspendPayload: Record<string, unknown> | null
}

/** The suspension payload written by `markSuspended`. */
export interface GateSuspension {
  runId: string
  threadId: string
  gateType: GateType
  toolCallId?: string | undefined
  toolName?: string | undefined
  args?: Record<string, unknown> | undefined
  suspendPayload?: Record<string, unknown> | undefined
}

export interface GateStore {
  upsert(ownerId: number, run: { runId: string; threadId: string }): Promise<void>
  markSuspended(ownerId: number, gate: GateSuspension): Promise<void>
  clear(ownerId: number, runId: string): Promise<void>
  resolve(ownerId: number, runId?: string): Promise<PendingGateRow | null>
}

export interface GateStoreConfig {
  /** The pointer table, e.g. `chat_pending_gates`. */
  table: string
  /** The per-actor key column, e.g. `user_id` or `admin_user_id`. */
  ownerColumn: string
  /**
   * How `markSuspended` writes. `update` matches the running row by run id;
   * `upsert` inserts if the row was never written (or was superseded), because
   * the suspension is the authoritative write.
   */
  markMode?: 'update' | 'upsert' | undefined
  resolve?:
    | {
        /** Surface only `status = 'suspended'` rows (a started run has nothing to render). */
        suspendedOnly?: boolean | undefined
        /**
         * Join an ownership table so a gate row whose run already settled (its
         * ownership row was cleared) is not surfaced.
         */
        ownershipJoin?: { table: string; runColumn: string; ownerColumn: string } | undefined
      }
    | undefined
}

interface DbRow {
  owner_id: number
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
    ownerId: row.owner_id,
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
 * Builds the durable pending-gate store shared by the support and customer
 * chat surfaces.
 *
 * The Mastra run is the source of truth; the row is a pointer so a suspended
 * tool approval or `ask_user` question can be re-surfaced after a reload, a
 * browser change or a server restart without an in-memory stream store (a
 * PostgresStoreVNext agent-run-status query is not exposed, so the indexed row
 * is the durable record). One row per actor: a new run supersedes a previous
 * pending one, and the previous run's terminal hook is guarded by run id in
 * `clear` so it cannot clear the newer run's row.
 *
 * The table and column names are internal constants (never request input), so
 * they are interpolated into the query text; every value stays parameterized.
 */
export function createGateStore(config: GateStoreConfig): GateStore {
  let { table, ownerColumn } = config
  let markMode = config.markMode ?? 'update'
  let resolveOptions = config.resolve ?? {}
  let join = resolveOptions.ownershipJoin

  function columns(alias: string): string {
    let p = alias ? alias + '.' : ''
    return [
      p + ownerColumn + ' AS owner_id',
      p + 'run_id',
      p + 'thread_id',
      p + 'status',
      p + 'tool_call_id',
      p + 'tool_name',
      p + 'args',
      p + 'gate_type',
      p + 'suspend_payload',
    ].join(', ')
  }

  return {
    async upsert(ownerId, run) {
      let now = Date.now()
      await db.exec(
        `INSERT INTO ${table}
           (${ownerColumn}, run_id, thread_id, status, created_at, updated_at)
         VALUES ($1, $2, $3, 'running', $4, $4)
         ON CONFLICT (${ownerColumn}) DO UPDATE SET
           run_id = EXCLUDED.run_id,
           thread_id = EXCLUDED.thread_id,
           status = EXCLUDED.status,
           tool_call_id = NULL,
           tool_name = NULL,
           args = NULL,
           gate_type = 'tool_decision',
           suspend_payload = NULL,
           updated_at = EXCLUDED.updated_at`,
        [ownerId, run.runId, run.threadId, now],
      )
    },

    async markSuspended(ownerId, gate) {
      let now = Date.now()
      let values = [
        gate.toolCallId ?? null,
        gate.toolName ?? null,
        gate.args ? JSON.stringify(gate.args) : null,
        gate.gateType,
        gate.suspendPayload ? JSON.stringify(gate.suspendPayload) : null,
      ]
      if (markMode === 'upsert') {
        await db.exec(
          `INSERT INTO ${table}
             (${ownerColumn}, run_id, thread_id, status, tool_call_id, tool_name, args, gate_type,
              suspend_payload, created_at, updated_at)
           VALUES ($1, $2, $3, 'suspended', $4, $5, $6, $7, $8, $9, $9)
           ON CONFLICT (${ownerColumn}) DO UPDATE SET
             run_id = EXCLUDED.run_id,
             thread_id = EXCLUDED.thread_id,
             status = 'suspended',
             tool_call_id = EXCLUDED.tool_call_id,
             tool_name = EXCLUDED.tool_name,
             args = EXCLUDED.args,
             gate_type = EXCLUDED.gate_type,
             suspend_payload = EXCLUDED.suspend_payload,
             updated_at = EXCLUDED.updated_at`,
          [ownerId, gate.runId, gate.threadId, ...values, now],
        )
      } else {
        await db.exec(
          `UPDATE ${table}
           SET status = 'suspended',
               tool_call_id = $1,
               tool_name = $2,
               args = $3,
               gate_type = $4,
               suspend_payload = $5,
               updated_at = $6
           WHERE ${ownerColumn} = $7 AND run_id = $8`,
          [...values, now, ownerId, gate.runId],
        )
      }
    },

    async clear(ownerId, runId) {
      await db.exec(`DELETE FROM ${table} WHERE ${ownerColumn} = $1 AND run_id = $2`, [
        ownerId,
        runId,
      ])
    },

    async resolve(ownerId, runId) {
      let result
      if (join) {
        // Honour a supplied run id here too: the chat export advertises the
        // optional second argument, and silently returning the actor's newest
        // gate would be a trap for any caller that passes one.
        let runFilter = runId !== undefined ? ' AND g.run_id = $2' : ''
        let suspendFilter = resolveOptions.suspendedOnly ? " AND g.status = 'suspended'" : ''
        result = await db.exec(
          `SELECT ${columns('g')}
           FROM ${table} g
           JOIN ${join.table} r ON r.${join.runColumn} = g.run_id AND r.${join.ownerColumn} = g.${ownerColumn}
           WHERE g.${ownerColumn} = $1${suspendFilter}${runFilter}
           ORDER BY g.updated_at DESC
           LIMIT 1`,
          runId !== undefined ? [ownerId, runId] : [ownerId],
        )
      } else if (runId !== undefined) {
        result = await db.exec(
          `SELECT ${columns('')}
           FROM ${table} WHERE ${ownerColumn} = $1 AND run_id = $2`,
          [ownerId, runId],
        )
      } else {
        result = await db.exec(
          `SELECT ${columns('')}
           FROM ${table} WHERE ${ownerColumn} = $1
           ORDER BY updated_at DESC LIMIT 1`,
          [ownerId],
        )
      }
      let row = (result.rows ?? [])[0] as DbRow | undefined
      return row ? toRow(row) : null
    },
  }
}
