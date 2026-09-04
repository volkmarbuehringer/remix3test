import { sql, type Database } from 'remix/data-table'
import { z } from 'zod/v4'

import { queryRows, queryRow, int8Aggregate } from './rows.ts'

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

const uploadRowSchema = z.object({
  id: z.number(),
  filename: z.string(),
  mime_type: z.string(),
  size: z.string(),
  created_at: z.string(),
})

export async function listUploads(db: Database, userId?: number): Promise<UploadRow[]> {
  let rows = await queryRows(
    db,
    userId !== undefined
      ? sql`SELECT id, filename, mime_type, size, created_at FROM uploads WHERE uploaded_by = ${userId} ORDER BY created_at DESC LIMIT 100`
      : sql`SELECT id, filename, mime_type, size, created_at FROM uploads ORDER BY created_at DESC LIMIT 100`,
    uploadRowSchema,
  )
  return rows.map((row) => ({
    id: row.id,
    filename: row.filename,
    mime_type: row.mime_type,
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
  let sizeRow = await queryRow(
    db,
    sql`SELECT size FROM uploads WHERE id = ${uploadId}`,
    z.object({ size: z.string() }),
  )
  if (!sizeRow) return false
  let newBytes = Number(sizeRow.size)

  // Exclude the row itself so re-claiming an already-owned upload does not
  // double-count it against the quota.
  let totalRow = await queryRow(
    db,
    sql`SELECT COALESCE(SUM(size), 0) AS total FROM uploads WHERE uploaded_by = ${userId} AND id <> ${uploadId}`,
    z.object({ total: int8Aggregate }),
  )
  let currentBytes = totalRow?.total ?? 0

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

const uploadDownloadRowSchema = z.object({
  filename: z.string(),
  mime_type: z.string(),
  data: z.custom<Buffer>(),
})

export async function getUploadDownload(
  db: Database,
  id: number,
  userId?: number,
): Promise<{ filename: string; mime_type: string; data: BodyInit } | undefined> {
  let row = await queryRow(
    db,
    userId !== undefined
      ? sql`SELECT filename, mime_type, data FROM uploads WHERE id = ${id} AND uploaded_by = ${userId}`
      : sql`SELECT filename, mime_type, data FROM uploads WHERE id = ${id}`,
    uploadDownloadRowSchema,
  )
  if (!row) return undefined
  return { filename: row.filename, mime_type: row.mime_type, data: row.data as BodyInit }
}

export async function insertUpload(
  db: Database,
  data: { filename: string; mimeType: string; buffer: Buffer; size: number; now: number },
): Promise<string> {
  let row = await queryRow(
    db,
    sql`INSERT INTO uploads (filename, mime_type, data, size, uploaded_by, created_at)
     VALUES (${data.filename}, ${data.mimeType}, ${data.buffer}, ${data.size}, NULL, ${data.now})
     RETURNING id`,
    z.object({ id: z.number() }),
  )
  if (!row) throw new Error('insertUpload: INSERT … RETURNING produced no row')
  return String(row.id)
}
