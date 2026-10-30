import { sql, type Database } from 'remix/data-table'
import { z } from 'zod/v4'

import { envPositiveNumber } from '../config.ts'
import { int8, int8Aggregate, queryRow, queryRows } from './rows.ts'

/**
 * Hard cap on the total bytes recorded for filesystem uploads. Enforced by the
 * streaming upload handler before and after each write using
 * {@link sumUploadFileBytes}; the bytes themselves never enter Postgres.
 */
export const uploadFilesTotalQuotaBytes = envPositiveNumber(
  'UPLOAD_FILES_QUOTA_BYTES',
  500 * 1024 * 1024,
)

/** Default per-uploader cap, matching the BYTEA uploads route's default. */
const DEFAULT_UPLOAD_FILES_PER_USER_QUOTA_BYTES = 100 * 1024 * 1024

/**
 * Configurable cap on the bytes a single uploader may store through the
 * filesystem route. Read on each call (not resolved at module load) so a
 * deployment or test can change `UPLOAD_FILES_PER_USER_QUOTA_BYTES` without a
 * restart; unset, non-numeric, or non-positive values fall back to the default.
 *
 * Enforced alongside {@link uploadFilesTotalQuotaBytes}: a file is rejected
 * when the uploader's own recorded bytes plus the new file would exceed this
 * cap, regardless of how much global headroom remains.
 */
export function uploadFilesPerUserQuotaBytes(): number {
  return envPositiveNumber(
    'UPLOAD_FILES_PER_USER_QUOTA_BYTES',
    DEFAULT_UPLOAD_FILES_PER_USER_QUOTA_BYTES,
  )
}

/** One row of the filesystem upload index (`upload_files`). */
export interface UploadFileRow {
  id: number
  storage_key: string
  filename: string
  mime_type: string
  size: number
  uploaded_by: number | null
  created_at: number
}

const uploadFileRowSchema = z.object({
  id: z.number(),
  storage_key: z.string(),
  filename: z.string(),
  mime_type: z.string(),
  size: int8,
  uploaded_by: z.number().nullable(),
  created_at: int8,
})

type DecodedUploadFileRow = z.output<typeof uploadFileRowSchema>

function decodeUploadFile(row: DecodedUploadFileRow): UploadFileRow {
  return {
    id: row.id,
    storage_key: row.storage_key,
    filename: row.filename,
    mime_type: row.mime_type,
    size: Number(row.size),
    uploaded_by: row.uploaded_by,
    created_at: Number(row.created_at),
  }
}

/** Fields of one stored filesystem upload recorded in the index. */
interface NewUploadFile {
  storageKey: string
  filename: string
  mimeType: string
  size: number
  uploadedBy: number | null
  now: number
}

/**
 * Record one stored filesystem upload. Called by the streaming handler after
 * the file is on disk; the caller must remove the file if this insert fails.
 *
 * @returns the new row id as a string, matching the `bytea` uploads module.
 */
export async function insertUploadFile(db: Database, data: NewUploadFile): Promise<string> {
  let row = await queryRow(
    db,
    sql`INSERT INTO upload_files (storage_key, filename, mime_type, size, uploaded_by, created_at)
     VALUES (${data.storageKey}, ${data.filename}, ${data.mimeType}, ${data.size}, ${data.uploadedBy}, ${data.now})
     RETURNING id`,
    z.object({ id: z.number() }),
  )
  if (!row) throw new Error('insertUploadFile: INSERT … RETURNING produced no row')
  return String(row.id)
}

/** Outcome of {@link insertUploadFileWithinUserQuota}. */
type QuotaGuardedInsertResult = { ok: true; id: string } | { ok: false; reason: 'per_user_quota' }

/**
 * Record a stored upload only when its owner still fits under `quotaBytes`.
 *
 * The admission check (SUM + INSERT) runs in one transaction under a per-user
 * advisory lock, so two concurrent uploads cannot both read the same pre-insert
 * total and jointly exceed the quota. A rejected file is the caller's to
 * delete; no row is written for it.
 *
 * Rows without an owner (`uploadedBy === null`) only count against the global
 * quota, which the streaming handler checks separately, so they are inserted
 * directly.
 */
export async function insertUploadFileWithinUserQuota(
  db: Database,
  data: NewUploadFile,
  quotaBytes: number,
): Promise<QuotaGuardedInsertResult> {
  if (data.uploadedBy == null) {
    return { ok: true, id: await insertUploadFile(db, data) }
  }

  let userId = data.uploadedBy
  return await db.transaction(async (tx): Promise<QuotaGuardedInsertResult> => {
    // Serialize admission for one uploader; see `claimUpload` in uploads.ts.
    await tx.exec('SELECT pg_advisory_xact_lock($1::bigint)', [userId])
    let usedBytes = await sumUploadFileBytesForUser(tx, userId)
    if (usedBytes + data.size > quotaBytes) return { ok: false, reason: 'per_user_quota' }
    return { ok: true, id: await insertUploadFile(tx, data) }
  })
}

/** Fetch one indexed upload by row id, or `undefined` when it does not exist. */
export async function getUploadFile(db: Database, id: number): Promise<UploadFileRow | undefined> {
  let row = await queryRow(
    db,
    sql`SELECT id, storage_key, filename, mime_type, size, uploaded_by, created_at
       FROM upload_files WHERE id = ${id}`,
    uploadFileRowSchema,
  )
  return row ? decodeUploadFile(row) : undefined
}

/** Newest-first page of the filesystem upload index. */
export async function listUploadFiles(
  db: Database,
  opts: { limit?: number; offset?: number } = {},
): Promise<UploadFileRow[]> {
  let { limit = 50, offset = 0 } = opts
  let rows = await queryRows(
    db,
    sql`SELECT id, storage_key, filename, mime_type, size, uploaded_by, created_at
       FROM upload_files
       ORDER BY created_at DESC, id DESC
       LIMIT ${limit} OFFSET ${offset}`,
    uploadFileRowSchema,
  )
  return rows.map(decodeUploadFile)
}

/** Total number of indexed filesystem uploads. */
export async function countUploadFiles(db: Database): Promise<number> {
  let row = await queryRow(
    db,
    sql`SELECT COUNT(*) AS total FROM upload_files`,
    z.object({ total: int8Aggregate }),
  )
  return row?.total ?? 0
}

/** Total bytes recorded for filesystem uploads (the global quota input). */
export async function sumUploadFileBytes(db: Database): Promise<number> {
  let row = await queryRow(
    db,
    sql`SELECT COALESCE(SUM(size), 0) AS total FROM upload_files`,
    z.object({ total: int8Aggregate }),
  )
  return row?.total ?? 0
}

/** Bytes recorded for one uploader (the per-user quota input). */
export async function sumUploadFileBytesForUser(db: Database, userId: number): Promise<number> {
  let row = await queryRow(
    db,
    sql`SELECT COALESCE(SUM(size), 0) AS total FROM upload_files WHERE uploaded_by = ${userId}`,
    z.object({ total: int8Aggregate }),
  )
  return row?.total ?? 0
}

/**
 * Delete one index row and return its storage key so the caller can remove the
 * file from `remix/file-storage`. Returns `undefined` when the row is gone.
 */
export async function deleteUploadFile(db: Database, id: number): Promise<string | undefined> {
  let row = await queryRow(
    db,
    sql`DELETE FROM upload_files WHERE id = ${id} RETURNING storage_key`,
    z.object({ storage_key: z.string() }),
  )
  return row?.storage_key
}
