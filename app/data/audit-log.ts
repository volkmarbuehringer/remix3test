import type { Database } from 'remix/data-table'

interface AuditLogEntry {
  admin_user_id: number
  admin_email: string
  action_type: string
  target_type: string
  target_id?: string | number
  details?: Record<string, unknown>
}

/**
 * Log an admin action to the audit trail.
 *
 * Audit-log failures are intentionally swallowed so they never block the
 * primary operation (e.g. user creation, config update). In development the
 * error is rethrown to surface schema/db issues; in production only a
 * console.error is emitted.
 */
export async function logAdminAction(
  db: Database,
  entry: AuditLogEntry,
): Promise<void> {
  try {
    await db.exec(
      `INSERT INTO audit_logs (admin_user_id, admin_email, action_type, target_type, target_id, details, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        entry.admin_user_id,
        entry.admin_email,
        entry.action_type,
        entry.target_type,
        entry.target_id != null ? String(entry.target_id) : null,
        entry.details ? JSON.stringify(entry.details) : null,
        Date.now(),
      ],
    )
  } catch (error) {
    if (process.env.NODE_ENV === 'development') throw error
    if (process.env.NODE_ENV !== 'test') {
      console.error('audit log write failed', error)
    }
  }
}
