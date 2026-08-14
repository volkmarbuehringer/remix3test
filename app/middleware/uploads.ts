import type { FileUpload } from 'remix/form-data-parser'
import { db } from '../db.ts'
import { insertUpload } from '../data/uploads.ts'
import { setUploadedId } from './upload-claim.ts'

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

const ALLOWED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.pdf',
  '.txt',
  '.csv',
  '.json',
  '.xml',
])

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
  'application/xml',
  'text/xml',
])

function validateFileUpload(file: FileUpload): void {
  let ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0]
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error('File type not allowed')
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error('File type not allowed')
  }

  let safeName = file.name.replace(/[/\\]/g, '_')
  if (safeName !== file.name) {
    throw new Error('Invalid filename')
  }
}

export async function uploadHandler(file: FileUpload): Promise<string | void> {
  if (file.fieldName !== 'file') return

  validateFileUpload(file)

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

  let id = await insertUpload(db, {
    filename: file.name,
    mimeType: file.type,
    buffer: data,
    size: data.length,
    now: Date.now(),
  })
  setUploadedId(id)
  return id
}
