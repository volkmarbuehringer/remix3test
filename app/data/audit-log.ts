import type { Pool } from 'pg'

export interface AuditLogEntry {
  admin_user_id: number
  admin_email: string
  action_type: string
  target_type: string
  target_id?: string | number
  details?: Record<string, unknown>
}

export async function logAdminAction(
  pool: Pool,
  entry: AuditLogEntry,
): Promise<void> {
  await pool.query(
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
}
