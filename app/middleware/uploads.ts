import type { FileUpload } from 'remix/form-data-parser'
import { pool } from '../data/setup.ts'

export async function uploadHandler(file: FileUpload): Promise<string | void> {
  if (file.fieldName !== 'file') return

  try {
    let chunks: Buffer[] = []
    let reader = file.stream().getReader()
    while (true) {
      let { done, value } = await reader.read()
      if (done) break
      chunks.push(Buffer.from(value!))
    }
    let data = Buffer.concat(chunks)

    let result = await pool.query(
      `INSERT INTO uploads (filename, mime_type, data, size, uploaded_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [file.name, file.type, data, data.length, null, Date.now()],
    )
    return String(result.rows[0].id)
  } catch {
    return
  }
}
