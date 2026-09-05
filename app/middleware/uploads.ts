import { formData } from 'remix/middleware/form-data'
import {
  MaxFilesExceededError,
  MaxFileSizeExceededError,
  MaxPartsExceededError,
  MaxTotalSizeExceededError,
  type FileUpload,
} from 'remix/form-data-parser'
import { redirect } from 'remix/response/redirect'
import type { Middleware } from 'remix/router'

import { db } from '../db.ts'
import { insertUpload, uploadsTotalQuotaBytes } from '../data/uploads.ts'
import { addUploadedId, setUploadError } from './upload-claim.ts'
import { routes } from '../routes.ts'

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

/**
 * Validate a single upload without throwing. Returns a German rejection message
 * when the file must be declined, or `null` to accept it. The handler records
 * the message through the request scope instead of throwing, so a bad file
 * renders the banner on the uploads page rather than an uncaught exception.
 */
function fileUploadErrorMessage(file: FileUpload): string | null {
  let ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0]
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) return 'Dateityp nicht erlaubt.'

  if (!ALLOWED_MIME_TYPES.has(file.type)) return 'Dateityp nicht erlaubt.'

  let safeName = file.name.replace(/[/\\]/g, '_')
  if (safeName !== file.name) return 'Ungültiger Dateiname.'

  return null
}

export async function uploadHandler(file: FileUpload): Promise<string | void> {
  if (file.fieldName !== 'file') return

  let validationError = fileUploadErrorMessage(file)
  if (validationError != null) {
    setUploadError(validationError)
    return
  }

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
      setUploadError('Datei zu groß (maximale Größe 50 MB).')
      return
    }
    chunks.push(chunk)
  }
  let data = Buffer.concat(chunks)

  // Global storage quota. Returning without storing (and without throwing — a
  // throw inside the handler rejects formData() and becomes a 500) leaves
  // uploadedId unset, so the uploads action renders its error banner for this
  // multipart post.
  let total = await db.exec('SELECT COALESCE(SUM(size), 0) AS total FROM uploads')
  let storedBytes = Number((total.rows?.[0] as { total: unknown } | undefined)?.total ?? 0)
  if (storedBytes + data.length > uploadsTotalQuotaBytes) {
    return
  }

  let id = await insertUpload(db, {
    filename: file.name,
    mimeType: file.type,
    buffer: data,
    size: data.length,
    now: Date.now(),
  })
  addUploadedId(id)
  return id
}

/**
 * Map a multipart limit error thrown by the streaming parser to a stable code
 * that the uploads controller turns into a German message. Returns `null` for
 * anything that is not a limit error.
 */
export function uploadLimitErrorCode(error: unknown): string | null {
  if (error instanceof MaxFileSizeExceededError) return 'file_too_large'
  if (error instanceof MaxFilesExceededError) return 'too_many_files'
  if (error instanceof MaxTotalSizeExceededError) return 'total_too_large'
  if (error instanceof MaxPartsExceededError) return 'too_many_parts'
  return null
}

const uploadsActionPath = routes.admin.uploads.action.href()
const uploadsIndexUrl = routes.admin.uploads.index.href()

/**
 * The upload-aware FormData middleware. It runs the streaming `formData()`
 * parser, but converts a multipart limit error (a file larger than the per-file
 * cap, too many files, etc.) on the uploads POST into a Post/Redirect/Get to
 * the uploads index carrying an `uploadError` code — instead of letting the
 * exception bubble to the top level as an uncaught 500.
 *
 * @returns A middleware compatible with the global chain.
 */
export function uploadFormData(): Middleware<{
  key: typeof FormData
  value: FormData
  property: 'formData'
}> {
  let parseForm = formData({
    uploadHandler,
    maxFileSize: MAX_UPLOAD_BYTES,
  })

  return async (context, next) => {
    try {
      return await parseForm(context, next)
    } catch (error) {
      if (context.method === 'POST' && context.url.pathname === uploadsActionPath) {
        let code = uploadLimitErrorCode(error)
        if (code != null) {
          // A file parsed before the offending part was already inserted as an
          // unclaimed row; leave it to retention pruning. Redirect so the
          // banner is rendered on a GET — the same path the frame reloads after
          // a submitted form action.
          return redirect(`${uploadsIndexUrl}?uploadError=${code}`)
        }
      }
      throw error
    }
  }
}
