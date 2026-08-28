import { db } from '../../db.ts'

export type ChatRunRow = {
  runId: string
  userId: number
  threadId: string
}

type DbRow = {
  run_id: string
  user_id: number
  thread_id: string
}

function toRow(row: DbRow): ChatRunRow {
  return { runId: row.run_id, userId: row.user_id, threadId: row.thread_id }
}

/**
 * Durable ownership mapping for the public /chat agent runs.
 *
 * The Mastra run is the source of truth (PostgresStoreVNext); this row is a
 * run_id -> user pointer so approve/decline/answer can verify ownership and
 * survive a server restart or scale-out without an in-memory stream store
 * (replacing the old process-local stream-store Map).
 *
 * Spike note (why a dedicated table, not a reuse): `admin_active_runs` is an
 * admin-workflow confirm-gate pointer (admin_user_id/workflow_id/status) and is
 * tied to the agent-events flow, not a customer-scoped run->user ownership
 * mapping; Mastra's PostgresStoreVNext does not expose a stable, supported
 * run->thread->resource query; and the app schema had no chat/run table. A
 * dedicated `chat_runs` run_id->user pointer is the clean, durable, indexed
 * fit.
 */
export async function recordChatRun(run: {
  runId: string
  userId: number
  threadId: string
}): Promise<void> {
  await db.exec(
    `INSERT INTO chat_runs (run_id, user_id, thread_id, created_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (run_id) DO NOTHING`,
    [run.runId, run.userId, run.threadId, Date.now()],
  )
}

/** Resolves the owning user (and thread) for a run id, or null if unknown. */
export async function findChatRunOwner(runId: string): Promise<ChatRunRow | null> {
  let result = await db.exec(
    `SELECT run_id, user_id, thread_id FROM chat_runs WHERE run_id = $1`,
    [runId],
  )
  let row = (result.rows ?? [])[0] as DbRow | undefined
  return row ? toRow(row) : null
}

/** Removes the ownership row once the run reaches a terminal state. */
export async function clearChatRun(runId: string): Promise<void> {
  await db.exec('DELETE FROM chat_runs WHERE run_id = $1', [runId])
}
