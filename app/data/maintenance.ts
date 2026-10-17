import type { Database } from 'remix/data-table'

import { envPositiveNumber } from '../config.ts'

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

/**
 * TTL for chat_runs ownership rows abandoned while suspended (browser closed,
 * crash, agent timeout). Terminal runs are deleted inline by clearChatRun;
 * this TTL bounds growth for everything else, as documented on the table in
 * db/schema.sql.
 */
const chatRunsTtlMs = envPositiveNumber('CHAT_RUNS_TTL_MS', DAY_MS)

const webhookRequestsRetentionMs = envPositiveNumber('WEBHOOK_REQUESTS_RETENTION_MS', 30 * DAY_MS)
const auditLogsRetentionMs = envPositiveNumber('AUDIT_LOGS_RETENTION_MS', 90 * DAY_MS)
const uploadsRetentionMs = envPositiveNumber('UPLOADS_RETENTION_MS', 90 * DAY_MS)

const maintenanceIntervalMs = envPositiveNumber('DATABASE_MAINTENANCE_INTERVAL_MS', HOUR_MS)

/**
 * Upper bound per DELETE statement inside one sweep tick. Bounded batches keep
 * every statement short: no long-running retention transaction, no WAL spike,
 * and a misconfigured TTL or outage backlog cannot pin the pool by deleting
 * six figures of rows (uploads store BYTEA) in one statement.
 */
const retentionBatchSize = Math.max(
  1,
  Math.floor(envPositiveNumber('DATABASE_MAINTENANCE_BATCH_SIZE', 5000)),
)

/**
 * Maximum DELETE statements one sweep tick performs per table. Whatever still
 * expires under the cutoff is drained by the following interval tick, so a
 * large backlog cannot monopolize one maintenance run.
 */
const maxBatchesPerSweep = Math.max(
  1,
  Math.floor(envPositiveNumber('DATABASE_MAINTENANCE_MAX_BATCHES', 20)),
)

/**
 * Bounded delete-by-created_at sweep. Table and key column are call-site
 * constants (never user input), so they are interpolated directly; only the
 * cutoff is parameterized. `batchSize` is injectable so tests can exercise the
 * multi-batch loop; production passes retentionBatchSize. Exported for tests.
 */
export async function deleteExpiredBatched(
  db: Database,
  table: 'chat_runs' | 'webhook_requests' | 'audit_logs' | 'uploads',
  keyColumn: 'run_id' | 'id',
  cutoff: number,
  batchSize: number = retentionBatchSize,
): Promise<number> {
  let total = 0
  let batches = 0
  for (;;) {
    let result = await db.exec(
      `DELETE FROM ${table} t
       WHERE t.${keyColumn} IN (
         SELECT s.${keyColumn} FROM ${table} s WHERE s.created_at < $1 LIMIT $2
       )`,
      [cutoff, batchSize],
    )

    let affectedRows = result.affectedRows ?? 0
    total += affectedRows
    batches++

    // A short batch means the sweep is done: no rows remain under the cutoff
    // beyond this one.
    if (affectedRows < batchSize) break
    // A full batch means more rows may linger; stop at the per-tick cap so the
    // remainder is drained on the next interval tick.
    if (batches >= maxBatchesPerSweep) break
  }
  return total
}

export async function deleteExpiredChatRuns(db: Database, ttlMs: number): Promise<number> {
  return await deleteExpiredBatched(db, 'chat_runs', 'run_id', Date.now() - ttlMs)
}

export async function deleteExpiredWebhookRequests(
  db: Database,
  retentionMs: number,
): Promise<number> {
  return await deleteExpiredBatched(
    db,
    'webhook_requests',
    'id',
    Date.now() - retentionMs,
  )
}

export async function deleteExpiredAuditLogs(db: Database, retentionMs: number): Promise<number> {
  return await deleteExpiredBatched(db, 'audit_logs', 'id', Date.now() - retentionMs)
}

export async function deleteExpiredUploads(db: Database, retentionMs: number): Promise<number> {
  return await deleteExpiredBatched(db, 'uploads', 'id', Date.now() - retentionMs)
}

/**
 * One retention sweep across all append-only/TTL tables. Each step is
 * individually guarded: a failed sweep must never break the next one, and a
 * failing step is logged instead of propagated (the interval keeps running).
 */
async function runDatabaseMaintenance(db: Database): Promise<void> {
  let deleted = { chatRuns: 0, webhookRequests: 0, auditLogs: 0, uploads: 0 }

  try {
    deleted.chatRuns = await deleteExpiredChatRuns(db, chatRunsTtlMs)
  } catch (error) {
    console.error('chat_runs TTL cleanup failed:', error)
  }
  try {
    deleted.webhookRequests = await deleteExpiredWebhookRequests(db, webhookRequestsRetentionMs)
  } catch (error) {
    console.error('webhook_requests retention cleanup failed:', error)
  }
  try {
    deleted.auditLogs = await deleteExpiredAuditLogs(db, auditLogsRetentionMs)
  } catch (error) {
    console.error('audit_logs retention cleanup failed:', error)
  }
  try {
    deleted.uploads = await deleteExpiredUploads(db, uploadsRetentionMs)
  } catch (error) {
    console.error('uploads retention cleanup failed:', error)
  }

  if (deleted.chatRuns || deleted.webhookRequests || deleted.auditLogs || deleted.uploads) {
    console.log(
      `Database maintenance: deleted ${deleted.chatRuns} chat_runs, ` +
        `${deleted.webhookRequests} webhook_requests, ${deleted.auditLogs} audit_logs, ` +
        `${deleted.uploads} uploads`,
    )
  }
}

let maintenanceTimer: ReturnType<typeof setInterval> | undefined

export function startDatabaseMaintenance(db: Database): void {
  if (maintenanceTimer) return
  void runDatabaseMaintenance(db)
  maintenanceTimer = setInterval(() => {
    void runDatabaseMaintenance(db)
  }, maintenanceIntervalMs)
  maintenanceTimer.unref?.()
}

export function stopDatabaseMaintenance(): void {
  if (maintenanceTimer !== undefined) {
    clearInterval(maintenanceTimer)
    maintenanceTimer = undefined
  }
}
