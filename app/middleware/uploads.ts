import type { FileUpload } from 'remix/form-data-parser'
import { pool } from '../data/setup.ts'

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

export async function uploadHandler(file: FileUpload): Promise<string | void> {
  if (file.fieldName !== 'file') return

  let chunks: Buffer[] = []
  let totalBytes = 0
  let reader = file.stream().getReader()
  while (true) {
    let { done, value } = await reader.read()
    if (done) break
    let chunk = Buffer.from(value!)
    totalBytes += chunk.length
    if (totalBytes > MAX_UPLOAD_BYTES) {
      await reader.cancel()
      throw new Error('File exceeds maximum size of 50 MB')
    }
    chunks.push(chunk)
  }
  let data = Buffer.concat(chunks)

  let result = await pool.query(
    `INSERT INTO uploads (filename, mime_type, data, size, uploaded_by, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [file.name, file.type, data, data.length, null, Date.now()],
  )
  return String(result.rows[0].id)
}
