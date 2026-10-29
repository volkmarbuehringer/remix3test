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
import { getCurrentUserSafely } from '../utils/context.ts'
import { addUploadedId, setUploadError } from './upload-claim.ts'
import { isAllowedCsrfOrigin } from './skip-csrf.ts'
import { routes } from '../routes.ts'
import {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_FILES,
  UPLOAD_TOO_LARGE_MESSAGE,
  normalizeMimeType,
} from '../utils/upload-validation.ts'

/**
 * Validate a single upload without throwing. Returns a German rejection message
 * when the file must be declined, or `null` to accept it. The handler records
 * the message through the request scope instead of throwing, so a bad file
 * renders the banner on the uploads page rather than an uncaught exception.
 */
function fileUploadErrorMessage(file: FileUpload): string | null {
  let ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0]
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) return 'Dateityp nicht erlaubt.'

  if (!ALLOWED_MIME_TYPES.has(normalizeMimeType(file.type))) return 'Dateityp nicht erlaubt.'

  let safeName = file.name.replace(/[/\\]/g, '_')
  if (safeName !== file.name) return 'Ungültiger Dateiname.'

  return null
}

async function uploadHandler(file: FileUpload): Promise<string | void> {
  if (file.fieldName !== 'file') return

  let validationError = fileUploadErrorMessage(file)
  if (validationError != null) {
    setUploadError(validationError)
    return
  }

  let chunks: Buffer[] = []
  let totalBytes = 0
  // `for await` yields `Uint8Array` chunks and cancels the stream on early
  // return, so no non-null assertion on a possibly-done read is needed.
  for await (let value of file.stream()) {
    let chunk = Buffer.from(value)
    totalBytes += chunk.length
    if (totalBytes > MAX_UPLOAD_BYTES) {
      setUploadError(UPLOAD_TOO_LARGE_MESSAGE)
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
    mimeType: normalizeMimeType(file.type),
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

function isMultipartForm(request: Request): boolean {
  return request.headers.get('Content-Type')?.toLowerCase().startsWith('multipart/') ?? false
}

/**
 * Read the auth state resolved by `loadAuth()` earlier in the root chain. The
 * guard fails closed when the auth middleware is absent (for example when a
 * unit test composes `uploadFormData()` on its own).
 */
function hasAuthenticatedUser(): boolean {
  try {
    return getCurrentUserSafely() != null
  } catch {
    return false
  }
}

/**
 * Pre-parse cross-origin guard for uploads. `skipCsrf()` still validates the
 * synchronizer token after parsing, but a cross-site form can carry the
 * victim's session cookie and would otherwise reach `uploadHandler` first.
 */
function isAllowedUploadOrigin(context: { url: URL; request: Request }): boolean {
  let origin = context.request.headers.get('Origin')
  if (origin != null) return isAllowedCsrfOrigin(origin, context)

  let fetchSite = context.request.headers.get('Sec-Fetch-Site')
  return fetchSite == null || fetchSite === 'same-origin' || fetchSite === 'none'
}

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
  let parseUploadForm = formData({
    uploadHandler,
    maxFileSize: MAX_UPLOAD_BYTES,
    // Explicit so the advertised "bis zu 20 Dateien" and the parser's limit
    // cannot drift apart if the shared constant changes.
    maxFiles: MAX_UPLOAD_FILES,
  })

  // Non-upload multipart bodies (for example a JavaScript `fetch(FormData)`
  // against a regular form action) still need parsing, but must never reach
  // the storage handler. Only the uploads action gets the parser that writes
  // accepted files.
  let parseForm = formData({
    maxFileSize: MAX_UPLOAD_BYTES,
    maxFiles: MAX_UPLOAD_FILES,
  })

  return async (context, next) => {
    let isUploadAction = context.url.pathname === uploadsActionPath

    // The parser is global because it also feeds `context.formData` to every
    // urlencoded form. On the uploads action, reject an unauthenticated
    // multipart request before `formData()` reads the body so it cannot fill
    // storage or make the parser buffer a large request. Auth runs earlier in
    // the root chain for exactly this guard; route-level requireAuth still
    // owns the normal login redirect.
    if (
      isMultipartForm(context.request) &&
      isUploadAction &&
      context.method === 'POST' &&
      !hasAuthenticatedUser()
    ) {
      return new Response('Unauthorized', {
        status: 401,
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    if (isMultipartForm(context.request) && isUploadAction && !isAllowedUploadOrigin(context)) {
      return new Response('Forbidden', {
        status: 403,
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    try {
      return await (isUploadAction ? parseUploadForm : parseForm)(context, next)
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
