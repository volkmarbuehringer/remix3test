import { sql, rawSql, type SqlStatement, type Database } from 'remix/data-table'
import { compileOrderByDirection } from 'remix/data-table/sql-helpers'
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

/** Columns the uploads grid may be sorted by (whitelist for the ORDER BY clause). */
export const UPLOAD_SORT_FIELDS = ['id', 'filename', 'mime_type', 'size', 'created_at'] as const

/**
 * MIME groupings the uploads grid can be filtered by. Each value maps to a
 * static WHERE fragment (see {@link kindCondition}) rather than an interpolated
 * value, so a URL-driven kind can never inject SQL. Shared with the controller
 * so its filter tabs stay in sync with the query layer.
 */
export const UPLOAD_KINDS = ['pdf', 'image', 'text'] as const

export type UploadKind = (typeof UPLOAD_KINDS)[number]

/** Type guard: true when `value` is one of the whitelisted upload kinds. */
export function isUploadKind(value: string | null | undefined): value is UploadKind {
  return value != null && (UPLOAD_KINDS as readonly string[]).includes(value)
}

/**
 * Static WHERE fragment for an upload kind. `text` covers every plain-text
 * family MIME the upload policy accepts (text/plain, CSV, JSON, XML); `image`
 * matches any `image/*`. Returns null for an absent/unknown kind (no filter).
 */
function kindCondition(kind: UploadKind | undefined): string | null {
  switch (kind) {
    case 'pdf':
      return `mime_type = 'application/pdf'`
    case 'image':
      return `mime_type LIKE 'image/%'`
    case 'text':
      return `mime_type IN ('text/plain', 'text/csv', 'application/json', 'application/xml', 'text/xml')`
    default:
      return null
  }
}

/**
 * Build a safe ORDER BY SqlStatement for the uploads grid. A column that is not
 * in {@link UPLOAD_SORT_FIELDS} is never interpolated (so a URL-driven value
 * cannot inject SQL) and falls back to the store's default newest-first order;
 * the `id` tiebreaker keeps pagination stable when the primary column has ties.
 */
function orderByStatement(sortColumn: string, sortDirection: 'asc' | 'desc'): SqlStatement {
  if (!(UPLOAD_SORT_FIELDS as readonly string[]).includes(sortColumn)) {
    return rawSql('ORDER BY created_at DESC, id DESC')
  }
  let dir = compileOrderByDirection(sortDirection)
  return rawSql(`ORDER BY ${sortColumn} ${dir}, id ${dir}`)
}

/**
 * Build a safe WHERE SqlStatement for the uploads grid. Combines the optional
 * per-user ownership restriction with an optional search filter (all values are
 * parameterized) and an optional MIME kind (a static, whitelisted fragment). A
 * numeric filter matches the row id exactly; any other filter matches filename
 * or mime_type with a case-insensitive substring search.
 */
function whereStatement(userId?: number, filter?: string, kind?: UploadKind): SqlStatement {
  let conditions: string[] = []
  let values: unknown[] = []
  if (userId !== undefined) {
    conditions.push('uploaded_by = ?')
    values.push(userId)
  }
  let kindSql = kindCondition(kind)
  if (kindSql) conditions.push(kindSql)
  let trimmed = filter?.trim()
  if (trimmed) {
    if (/^\d+$/.test(trimmed)) {
      conditions.push('id = ?')
      values.push(Number(trimmed))
    } else {
      // Escape LIKE metacharacters so a filter cannot broaden the search with
      // `%`/`_` (the value is bound, so this is search semantics, not injection).
      let escaped = trimmed.replace(/[%_\\]/g, '\\$&')
      conditions.push('(filename ILIKE ? OR mime_type ILIKE ?)')
      values.push(`%${escaped}%`, `%${escaped}%`)
    }
  }
  if (conditions.length === 0) return rawSql('')
  return rawSql(`WHERE ${conditions.join(' AND ')}`, values)
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
  opts: {
    limit?: number
    offset?: number
    sortColumn?: string | undefined
    sortDirection?: 'asc' | 'desc' | undefined
    filter?: string | undefined
    kind?: UploadKind | undefined
  } = {},
): Promise<UploadRow[]> {
  let {
    limit = 100,
    offset = 0,
    sortColumn = 'created_at',
    sortDirection = 'desc',
    filter,
    kind,
  } = opts
  let orderBy = orderByStatement(sortColumn, sortDirection)
  let where = whereStatement(userId, filter, kind)
  let rows = await queryRows(
    db,
    sql`SELECT id, filename, mime_type, size, created_at FROM uploads ${where} ${orderBy} LIMIT ${limit} OFFSET ${offset}`,
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

/**
 * Total number of uploads, optionally limited to one user's claims, a search
 * filter, or a MIME kind.
 */
export async function countUploads(
  db: Database,
  userId?: number,
  filter?: string,
  kind?: UploadKind,
): Promise<number> {
  let where = whereStatement(userId, filter, kind)
  let row = await queryRow(
    db,
    sql`SELECT COUNT(*) AS total FROM uploads ${where}`,
    z.object({ total: int8Aggregate }),
  )
  return row?.total ?? 0
}

/**
 * Fetch one page of uploads with its total count and page count. `page` is
 * 1-based and `pageSize` is the configured page size (session-aware).
 * `sortColumn`/`sortDirection` control ordering (default newest-first) and
 * `filter` narrows the result set (and the total used for pagination) and
 * `kind` restricts it to one MIME grouping. The page is clamped to the valid
 * range and the effective page is returned so callers can render the controls
 * against the page actually displayed.
 */
export async function getUploadsPage(
  db: Database,
  userId: number | undefined,
  page: number,
  pageSize: number,
  sortColumn?: string | undefined,
  sortDirection?: 'asc' | 'desc' | undefined,
  filter?: string | undefined,
  kind?: UploadKind | undefined,
): Promise<{ rows: UploadRow[]; total: number; totalPages: number; page: number }> {
  let total = await countUploads(db, userId, filter, kind)
  let totalPages = Math.max(1, Math.ceil(total / pageSize))
  let safePage = Math.min(Math.max(1, page), totalPages)
  let offset = (safePage - 1) * pageSize
  let rows = await listUploads(db, userId, {
    limit: pageSize,
    offset,
    sortColumn,
    sortDirection,
    filter,
    kind,
  })
  return { rows, total, totalPages, page: safePage }
}

/**
 * Storage quota usage for the uploads grid header. Returns the calling user's
 * used and quota bytes plus the global totals. `userId === undefined` (admin
 * viewing everything) reports global used/total with a null per-user quota.
 */
export async function getUploadsQuotaUsage(
  db: Database,
  userId?: number,
): Promise<{
  userUsedBytes: number
  userQuotaBytes: number | null
  totalUsedBytes: number
  totalQuotaBytes: number
}> {
  let userUsedBytes = 0
  if (userId !== undefined) {
    let row = await queryRow(
      db,
      sql`SELECT COALESCE(SUM(size), 0) AS total FROM uploads WHERE uploaded_by = ${userId}`,
      z.object({ total: int8Aggregate }),
    )
    userUsedBytes = row?.total ?? 0
  }
  let totalRow = await queryRow(
    db,
    sql`SELECT COALESCE(SUM(size), 0) AS total FROM uploads`,
    z.object({ total: int8Aggregate }),
  )
  return {
    userUsedBytes,
    userQuotaBytes: userId !== undefined ? uploadsPerUserQuotaBytes : null,
    totalUsedBytes: totalRow?.total ?? 0,
    totalQuotaBytes: uploadsTotalQuotaBytes,
  }
}

export async function claimUpload(
  db: Database,
  uploadId: number,
  userId: number,
  quotaBytes: number = uploadsPerUserQuotaBytes,
): Promise<boolean> {
  return await db.transaction(async (tx) => {
    // Serialize concurrent claims for the same user. The quota check is a
    // read-then-write, so without this lock two requests can both read the same
    // pre-claim total, both pass, and between them exceed the per-user quota.
    await tx.exec('SELECT pg_advisory_xact_lock($1::bigint)', [userId])

    let sizeRow = await queryRow(
      tx,
      sql`SELECT size FROM uploads WHERE id = ${uploadId}`,
      z.object({ size: z.string() }),
    )
    if (!sizeRow) return false
    let newBytes = Number(sizeRow.size)

    // Exclude the row itself so re-claiming an already-owned upload does not
    // double-count it against the quota.
    let totalRow = await queryRow(
      tx,
      sql`SELECT COALESCE(SUM(size), 0) AS total FROM uploads WHERE uploaded_by = ${userId} AND id <> ${uploadId}`,
      z.object({ total: int8Aggregate }),
    )
    let currentBytes = totalRow?.total ?? 0

    if (currentBytes + newBytes > quotaBytes) {
      // Reject and remove the still-unclaimed row so a refused upload does not
      // linger as an orphan until retention prunes it.
      await tx.exec('DELETE FROM uploads WHERE id = $1 AND uploaded_by IS NULL', [uploadId])
      return false
    }

    await tx.exec(
      `UPDATE uploads SET uploaded_by = $1 WHERE id = $2 AND (uploaded_by IS NULL OR uploaded_by = $1)`,
      [userId, uploadId],
    )
    return true
  })
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

  return await db.transaction(async (tx) => {
    // Same per-user serialization as claimUpload: a batch claim must not race a
    // concurrent single or batch claim, or the quota check can be bypassed.
    await tx.exec('SELECT pg_advisory_xact_lock($1::bigint)', [userId])

    let sizeRows = await queryRows(
      tx,
      sql`SELECT id, size FROM uploads WHERE id = ANY(${uploadIds}::int[]) AND (uploaded_by IS NULL OR uploaded_by = ${userId})`,
      z.object({ id: z.number(), size: z.string() }),
    )
    if (sizeRows.length === 0) return false

    let batchBytes = sizeRows.reduce((sum, row) => sum + Number(row.size), 0)

    let totalRow = await queryRow(
      tx,
      sql`SELECT COALESCE(SUM(size), 0) AS total FROM uploads WHERE uploaded_by = ${userId}`,
      z.object({ total: int8Aggregate }),
    )
    let currentBytes = totalRow?.total ?? 0

    if (currentBytes + batchBytes > quotaBytes) {
      // Reject and remove every still-unclaimed row so a refused batch does not
      // linger as orphans until retention prunes them.
      await tx.exec('DELETE FROM uploads WHERE id = ANY($1::int[]) AND uploaded_by IS NULL', [
        uploadIds,
      ])
      return false
    }

    await tx.exec(
      `UPDATE uploads SET uploaded_by = $1 WHERE id = ANY($2::int[]) AND (uploaded_by IS NULL OR uploaded_by = $1)`,
      [userId, uploadIds],
    )
    return true
  })
}

const uploadDownloadRowSchema = z.object({
  filename: z.string(),
  mime_type: z.string(),
  data: z.custom<Buffer>(),
})

const uploadDownloadBatchRowSchema = z.object({
  id: z.number(),
  filename: z.string(),
  mime_type: z.string(),
  data: z.custom<Buffer>(),
})

/**
 * Delete a single upload. Admins may delete any row; a non-admin caller must
 * pass `userId` so the row is only deleted when it belongs to them (an upload
 * the caller did not claim is left untouched). Mirrors the ownership split used
 * by {@link getUploadDownload} and the uploads grid.
 *
 * @returns `true` when a row was actually deleted.
 */
export async function deleteUpload(db: Database, id: number, userId?: number): Promise<boolean> {
  let result =
    userId !== undefined
      ? await db.exec('DELETE FROM uploads WHERE id = $1 AND uploaded_by = $2', [id, userId])
      : await db.exec('DELETE FROM uploads WHERE id = $1', [id])
  return (result.affectedRows ?? 0) > 0
}

/**
 * Delete several uploads in one operation. Admins may delete any row; a
 * non-admin caller must pass `userId` so each row is only deleted when it
 * belongs to them (rows the caller did not claim are left untouched) — mirroring
 * the ownership split used by {@link deleteUpload} and the uploads grid. Ids are
 * deduplicated before the delete so the `ANY` array parameter stays unambiguous.
 *
 * @returns the number of rows actually deleted.
 */
export async function deleteUploads(db: Database, ids: number[], userId?: number): Promise<number> {
  let uniqueIds = [...new Set(ids)]
  if (uniqueIds.length === 0) return 0
  let result =
    userId !== undefined
      ? await db.exec('DELETE FROM uploads WHERE id = ANY($1::int[]) AND uploaded_by = $2', [
          uniqueIds,
          userId,
        ])
      : await db.exec('DELETE FROM uploads WHERE id = ANY($1::int[])', [uniqueIds])
  return result.affectedRows ?? 0
}

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

/**
 * Fetch several uploads (filenames and full BYTEA payloads) for a multirow
 * download. Admins may fetch any row; a non-admin caller must pass `userId` so
 * each row is only returned when it belongs to them — mirroring the ownership
 * split used by {@link getUploadDownload} and the uploads grid. Ids are
 * deduplicated before the query so the `ANY` array parameter stays unambiguous.
 */
export async function getUploadsByIds(
  db: Database,
  ids: number[],
  userId?: number,
): Promise<{ id: number; filename: string; mime_type: string; data: Buffer }[]> {
  let uniqueIds = [...new Set(ids)]
  if (uniqueIds.length === 0) return []
  let rows = await queryRows(
    db,
    userId !== undefined
      ? sql`SELECT id, filename, mime_type, data FROM uploads WHERE id = ANY(${uniqueIds}::int[]) AND uploaded_by = ${userId}`
      : sql`SELECT id, filename, mime_type, data FROM uploads WHERE id = ANY(${uniqueIds}::int[])`,
    uploadDownloadBatchRowSchema,
  )
  return rows.map((row) => ({
    id: row.id,
    filename: row.filename,
    mime_type: row.mime_type,
    data: row.data as Buffer,
  }))
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
