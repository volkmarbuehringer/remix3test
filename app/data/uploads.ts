import { type Database } from 'remix/data-table'

function envBytes(name: string, fallback: number): number {
  let value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

/** Hard cap on total BYTEA storage across all users (uploads live in the primary database). */
export const uploadsTotalQuotaBytes = envBytes('UPLOADS_TOTAL_QUOTA_BYTES', 500 * 1024 * 1024)

/** Hard cap on total BYTEA storage a single user may claim. */
const uploadsPerUserQuotaBytes = envBytes('UPLOADS_PER_USER_QUOTA_BYTES', 100 * 1024 * 1024)

export interface UploadRow {
  id: number
  filename: string
  mime_type: string
  size: number
  created_at: number
}

export async function listUploads(db: Database, userId?: number): Promise<UploadRow[]> {
  let result
  if (userId !== undefined) {
    result = await db.exec(
      `SELECT id, filename, mime_type, size, created_at FROM uploads WHERE uploaded_by = $1 ORDER BY created_at DESC LIMIT 100`,
      [userId],
    )
  } else {
    result = await db.exec(
      `SELECT id, filename, mime_type, size, created_at FROM uploads ORDER BY created_at DESC LIMIT 100`,
    )
  }
  return ((result.rows ?? []) as Record<string, unknown>[]).map((row) => ({
    id: Number(row.id),
    filename: row.filename as string,
    mime_type: row.mime_type as string,
    size: Number(row.size),
    created_at: Number(row.created_at),
  }))
}

export async function claimUpload(
  db: Database,
  uploadId: number,
  userId: number,
  quotaBytes: number = uploadsPerUserQuotaBytes,
): Promise<boolean> {
  let sizeResult = await db.exec('SELECT size FROM uploads WHERE id = $1', [uploadId])
  let sizeRow = sizeResult.rows?.[0] as { size: unknown } | undefined
  if (!sizeRow) return false
  let newBytes = Number(sizeRow.size)

  // Exclude the row itself so re-claiming an already-owned upload does not
  // double-count it against the quota.
  let totalResult = await db.exec(
    'SELECT COALESCE(SUM(size), 0) AS total FROM uploads WHERE uploaded_by = $1 AND id <> $2',
    [userId, uploadId],
  )
  let currentBytes = Number((totalResult.rows?.[0] as { total: unknown } | undefined)?.total ?? 0)

  if (currentBytes + newBytes > quotaBytes) {
    // Reject and remove the still-unclaimed row so a refused upload does not
    // linger as an orphan until retention prunes it.
    await db.exec('DELETE FROM uploads WHERE id = $1 AND uploaded_by IS NULL', [uploadId])
    return false
  }

  await db.exec(
    `UPDATE uploads SET uploaded_by = $1 WHERE id = $2 AND (uploaded_by IS NULL OR uploaded_by = $1)`,
    [userId, uploadId],
  )
  return true
}

export async function getUploadDownload(
  db: Database,
  id: number,
  userId?: number,
): Promise<{ filename: string; mime_type: string; data: BodyInit } | undefined> {
  let result: { rows?: Record<string, unknown>[] }
  if (userId !== undefined) {
    result = await db.exec(
      `SELECT filename, mime_type, data FROM uploads WHERE id = $1 AND uploaded_by = $2`,
      [id, userId],
    )
  } else {
    result = await db.exec(`SELECT filename, mime_type, data FROM uploads WHERE id = $1`, [id])
  }
  return (result.rows ?? []).length > 0
    ? (result.rows![0] as unknown as { filename: string; mime_type: string; data: BodyInit })
    : undefined
}

export async function insertUpload(
  db: Database,
  data: { filename: string; mimeType: string; buffer: Buffer; size: number; now: number },
): Promise<string> {
  let result = await db.exec(
    `INSERT INTO uploads (filename, mime_type, data, size, uploaded_by, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [data.filename, data.mimeType, data.buffer, data.size, null, data.now],
  )
  let row = result.rows?.[0] as { id: unknown } | undefined
  if (!row) throw new Error('insertUpload: INSERT … RETURNING produced no row')
  return String(row.id)
}
