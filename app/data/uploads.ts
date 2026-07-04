import { type Database } from 'remix/data-table'

export interface UploadRow {
  id: number
  filename: string
  mime_type: string
  size: number
  created_at: number
}

export async function listUploads(
  db: Database,
  userId?: number,
): Promise<UploadRow[]> {
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
): Promise<void> {
  await db.exec(
    `UPDATE uploads SET uploaded_by = $1 WHERE id = $2 AND (uploaded_by IS NULL OR uploaded_by = $1)`,
    [userId, uploadId],
  )
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
    result = await db.exec(
      `SELECT filename, mime_type, data FROM uploads WHERE id = $1`,
      [id],
    )
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
