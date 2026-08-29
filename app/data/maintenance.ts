import type { Database } from 'remix/data-table'

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

function envMs(name: string, fallback: number): number {
  let value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

/**
 * TTL for chat_runs ownership rows abandoned while suspended (browser closed,
 * crash, agent timeout). Terminal runs are deleted inline by clearChatRun;
 * this TTL bounds growth for everything else, as documented on the table in
 * db/schema.sql.
 */
export const chatRunsTtlMs = envMs('CHAT_RUNS_TTL_MS', DAY_MS)

export const webhookRequestsRetentionMs = envMs('WEBHOOK_REQUESTS_RETENTION_MS', 30 * DAY_MS)
export const auditLogsRetentionMs = envMs('AUDIT_LOGS_RETENTION_MS', 90 * DAY_MS)
export const uploadsRetentionMs = envMs('UPLOADS_RETENTION_MS', 90 * DAY_MS)

const maintenanceIntervalMs = envMs('DATABASE_MAINTENANCE_INTERVAL_MS', HOUR_MS)

export async function deleteExpiredChatRuns(db: Database, ttlMs: number): Promise<number> {
  let result = await db.exec('DELETE FROM chat_runs WHERE created_at < $1', [Date.now() - ttlMs])
  return result.affectedRows ?? 0
}

export async function deleteExpiredWebhookRequests(
  db: Database,
  retentionMs: number,
): Promise<number> {
  let result = await db.exec('DELETE FROM webhook_requests WHERE created_at < $1', [
    Date.now() - retentionMs,
  ])
  return result.affectedRows ?? 0
}

export async function deleteExpiredAuditLogs(db: Database, retentionMs: number): Promise<number> {
  let result = await db.exec('DELETE FROM audit_logs WHERE created_at < $1', [
    Date.now() - retentionMs,
  ])
  return result.affectedRows ?? 0
}

export async function deleteExpiredUploads(db: Database, retentionMs: number): Promise<number> {
  let result = await db.exec('DELETE FROM uploads WHERE created_at < $1', [
    Date.now() - retentionMs,
  ])
  return result.affectedRows ?? 0
}

/**
 * One retention sweep across all append-only/TTL tables. Each step is
 * individually guarded: a failed sweep must never break the next one, and a
 * failing step is logged instead of propagated (the interval keeps running).
 */
export async function runDatabaseMaintenance(db: Database): Promise<void> {
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
