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

/**
 * Record one stored filesystem upload. Called by the streaming handler after
 * the file is on disk; the caller must remove the file if this insert fails.
 *
 * @returns the new row id as a string, matching the `bytea` uploads module.
 */
export async function insertUploadFile(
  db: Database,
  data: {
    storageKey: string
    filename: string
    mimeType: string
    size: number
    uploadedBy: number | null
    now: number
  },
): Promise<string> {
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

/** Total bytes recorded for filesystem uploads (the quota input). */
export async function sumUploadFileBytes(db: Database): Promise<number> {
  let row = await queryRow(
    db,
    sql`SELECT COALESCE(SUM(size), 0) AS total FROM upload_files`,
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
