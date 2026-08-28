import { db } from '../../db.ts'

export type ActiveRunStatus = 'running' | 'suspended'

export type ActiveRunRow = {
  adminUserId: number
  runId: string
  workflowId: string
  status: ActiveRunStatus
  stepId: string | null
  suspendPayload: Record<string, unknown> | null
}

type DbRow = {
  admin_user_id: number
  run_id: string
  workflow_id: string
  status: ActiveRunStatus
  step_id: string | null
  suspend_payload: Record<string, unknown> | null
}

function toRow(row: DbRow): ActiveRunRow {
  return {
    adminUserId: row.admin_user_id,
    runId: row.run_id,
    workflowId: row.workflow_id,
    status: row.status,
    stepId: row.step_id,
    suspendPayload: row.suspend_payload,
  }
}

/**
 * Records (or replaces) the active run pointer for an admin. One row per admin:
 * a new run supersedes a previous suspended one. The previous run's late
 * finish/error/canceled hook is guarded by run id in clearActiveRun, so it
 * cannot clear the newer run's row.
 */
export async function upsertActiveRun(
  adminUserId: number,
  run: { runId: string; workflowId: string; status: ActiveRunStatus },
): Promise<void> {
  let now = Date.now()
  await db.exec(
    `INSERT INTO admin_active_runs
       (admin_user_id, run_id, workflow_id, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $5)
     ON CONFLICT (admin_user_id) DO UPDATE SET
       run_id = EXCLUDED.run_id,
       workflow_id = EXCLUDED.workflow_id,
       status = EXCLUDED.status,
       step_id = NULL,
       suspend_payload = NULL,
       updated_at = EXCLUDED.updated_at`,
    [adminUserId, run.runId, run.workflowId, run.status, now],
  )
}

export async function markSuspended(
  adminUserId: number,
  runId: string,
  stepId: string,
  suspendPayload: Record<string, unknown>,
): Promise<void> {
  await db.exec(
    `UPDATE admin_active_runs
     SET status = 'suspended', step_id = $1, suspend_payload = $2, updated_at = $3
     WHERE admin_user_id = $4 AND run_id = $5`,
    [stepId, JSON.stringify(suspendPayload), Date.now(), adminUserId, runId],
  )
}

/**
 * Clears the active run pointer. Guarded by run id: if the admin started a
 * newer run, the older run's completion must not clear the newer row.
 */
export async function clearActiveRun(adminUserId: number, runId: string): Promise<void> {
  await db.exec('DELETE FROM admin_active_runs WHERE admin_user_id = $1 AND run_id = $2', [
    adminUserId,
    runId,
  ])
}

export async function findActiveRun(adminUserId: number): Promise<ActiveRunRow | null> {
  let result = await db.exec(
    `SELECT admin_user_id, run_id, workflow_id, status, step_id, suspend_payload
     FROM admin_active_runs WHERE admin_user_id = $1`,
    [adminUserId],
  )
  let row = (result.rows ?? [])[0] as DbRow | undefined
  return row ? toRow(row) : null
}

export async function findRunOwner(runId: string): Promise<number | null> {
  let result = await db.exec('SELECT admin_user_id FROM admin_active_runs WHERE run_id = $1', [
    runId,
  ])
  let row = (result.rows ?? [])[0] as { admin_user_id: number } | undefined
  return row ? row.admin_user_id : null
}

/** Resolves a run id to its full active-run row (for resume ownership checks). */
export async function findRunById(runId: string): Promise<ActiveRunRow | null> {
  let result = await db.exec(
    `SELECT admin_user_id, run_id, workflow_id, status, step_id, suspend_payload
     FROM admin_active_runs WHERE run_id = $1`,
    [runId],
  )
  let row = (result.rows ?? [])[0] as DbRow | undefined
  return row ? toRow(row) : null
}
