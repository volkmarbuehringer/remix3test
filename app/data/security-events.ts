import type { Database } from 'remix/data-table'

import { isDevelopment, isTest } from '../config.ts'

export interface SecurityEventEntry {
  /** e.g. login_success, login_failed, login_locked, api_token_issued, logout. */
  event_type: string
  /** Nullable: a failed login for an unknown email has no user row. */
  user_id?: number | null
  /** The (normalized) email the event concerns, when known. */
  email?: string | null
  /** Trusted TCP-derived client IP (connectionIp), never a spoofable header. */
  ip?: string | null
  details?: Record<string, unknown>
}

async function insertSecurityEvent(database: Database, entry: SecurityEventEntry): Promise<void> {
  await database.exec(
    `INSERT INTO security_events (event_type, user_id, email, ip, details, created_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
    [
      entry.event_type,
      entry.user_id ?? null,
      entry.email ?? null,
      entry.ip ?? null,
      entry.details ? JSON.stringify(entry.details) : null,
      Date.now(),
    ],
  )
}

/**
 * Persist a security-relevant event to the durable audit sink (M6): login
 * success/failure, lockouts, API-token issuance/revocation, password changes and
 * logouts. Unlike `audit_logs` (admin mutations), this table captures
 * authentication activity for correlation and alerting.
 *
 * Failures are intentionally swallowed so they never block the primary
 * operation (a login must not fail because the audit insert failed). In
 * development the error is rethrown to surface schema/db issues; in production
 * only a console.error is emitted. Retention is handled by the maintenance sweep.
 */
export async function logSecurityEvent(db: Database, entry: SecurityEventEntry): Promise<void> {
  try {
    await insertSecurityEvent(db, entry)
  } catch (error) {
    if (isDevelopment) throw error
    if (!isTest) {
      console.error('security event write failed', error)
    }
  }
}
