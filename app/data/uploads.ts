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

/** Uploader-facing rejection reasons, keyed by a stable code carried in the URL. */
export const uploadErrorMessages: Record<string, string> = {
  file_too_large: 'Eine Datei überschreitet die maximale Größe von 50 MB.',
  too_many_files: 'Zu viele Dateien in einem Upload (maximal 20).',
  total_too_large: 'Der Upload überschreitet die maximale Gesamtgröße.',
  too_many_parts: 'Zu viele Formularfelder in der Anfrage.',
}

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

export async function listUploads(
  db: Database,
  userId?: number,
  opts: { limit?: number; offset?: number } = {},
): Promise<UploadRow[]> {
  let { limit = 100, offset = 0 } = opts
  let rows = await queryRows(
    db,
    userId !== undefined
      ? sql`SELECT id, filename, mime_type, size, created_at FROM uploads WHERE uploaded_by = ${userId} ORDER BY created_at DESC, id DESC LIMIT ${limit} OFFSET ${offset}`
      : sql`SELECT id, filename, mime_type, size, created_at FROM uploads ORDER BY created_at DESC, id DESC LIMIT ${limit} OFFSET ${offset}`,
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

/** Total number of uploads, optionally limited to one user's claims. */
export async function countUploads(db: Database, userId?: number): Promise<number> {
  let row = await queryRow(
    db,
    userId !== undefined
      ? sql`SELECT COUNT(*) AS total FROM uploads WHERE uploaded_by = ${userId}`
      : sql`SELECT COUNT(*) AS total FROM uploads`,
    z.object({ total: int8Aggregate }),
  )
  return row?.total ?? 0
}

/**
 * Fetch one page of uploads with its total count and page count. `page` is
 * 1-based and `pageSize` is the configured page size (session-aware). Results
 * are ordered newest-first. The page is clamped to the valid range and the
 * effective page is returned so callers can render the controls against the
 * page actually displayed.
 */
export async function getUploadsPage(
  db: Database,
  userId: number | undefined,
  page: number,
  pageSize: number,
): Promise<{ rows: UploadRow[]; total: number; totalPages: number; page: number }> {
  let total = await countUploads(db, userId)
  let totalPages = Math.max(1, Math.ceil(total / pageSize))
  let safePage = Math.min(Math.max(1, page), totalPages)
  let offset = (safePage - 1) * pageSize
  let rows = await listUploads(db, userId, { limit: pageSize, offset })
  return { rows, total, totalPages, page: safePage }
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

/**
 * Claim a batch of freshly-inserted uploads (from one multi-file request) for a
 * user in a single quota check. Unlike looping {@link claimUpload} per id, this
 * measures the batch's total size against the user's remaining quota once, so a
 * near-quota user cannot slip over by the sum of the other files in the request.
 *
 * @returns `true` when every row in the batch was claimed; `false` when the
 *   batch exceeds the user's quota (all still-unclaimed batch rows are deleted).
 */
export async function claimUploads(
  db: Database,
  uploadIds: number[],
  userId: number,
  quotaBytes: number = uploadsPerUserQuotaBytes,
): Promise<boolean> {
  if (uploadIds.length === 0) return false

  let sizeRows = await queryRows(
    db,
    sql`SELECT id, size FROM uploads WHERE id = ANY(${uploadIds}::int[]) AND (uploaded_by IS NULL OR uploaded_by = ${userId})`,
    z.object({ id: z.number(), size: z.string() }),
  )
  if (sizeRows.length === 0) return false

  let batchBytes = sizeRows.reduce((sum, row) => sum + Number(row.size), 0)

  let totalRow = await queryRow(
    db,
    sql`SELECT COALESCE(SUM(size), 0) AS total FROM uploads WHERE uploaded_by = ${userId}`,
    z.object({ total: int8Aggregate }),
  )
  let currentBytes = totalRow?.total ?? 0

  if (currentBytes + batchBytes > quotaBytes) {
    // Reject and remove every still-unclaimed row so a refused batch does not
    // linger as orphans until retention prunes them.
    await db.exec('DELETE FROM uploads WHERE id = ANY($1::int[]) AND uploaded_by IS NULL', [
      uploadIds,
    ])
    return false
  }

  await db.exec(
    `UPDATE uploads SET uploaded_by = $1 WHERE id = ANY($2::int[]) AND (uploaded_by IS NULL OR uploaded_by = $1)`,
    [userId, uploadIds],
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
