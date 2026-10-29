import { formData } from 'remix/middleware/form-data'
import type { FileUpload } from 'remix/form-data-parser'
import { redirect } from 'remix/response/redirect'
import type { Middleware } from 'remix/router'

import { db } from '../db.ts'
import { insertUpload, uploadsTotalQuotaBytes } from '../data/uploads.ts'
import { getCurrentUserSafely } from '../utils/context.ts'
import { addUploadedId, setUploadError } from './upload-claim.ts'
import { createUploadFilesParser, isMultipartForm, uploadLimitErrorCode } from './upload-files.ts'
import { isAllowedCsrfOrigin } from './skip-csrf.ts'
import { routes } from '../routes.ts'
import {
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_FILES,
  UPLOAD_TOO_LARGE_MESSAGE,
  normalizeMimeType,
  validateUploadMetadata,
} from '../utils/upload-validation.ts'

export { uploadLimitErrorCode }

/**
 * Validate a single upload without throwing. Returns a German rejection message
 * when the file must be declined, or `null` to accept it. The handler records
 * the message through the request scope instead of throwing, so a bad file
 * renders the banner on the uploads page rather than an uncaught exception.
 */
function fileUploadErrorMessage(file: FileUpload): string | null {
  return validateUploadMetadata(file)
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

const uploadsActionPath = routes.admin.uploads.action.href()
const uploadsIndexUrl = routes.admin.uploads.index.href()
const uploadNewActionPath = routes.admin.uploadnew.action.href()
const uploadNewIndexUrl = routes.admin.uploadnew.index.href()

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
 * The filesystem streaming route is admin-only. Its auth check runs at the
 * action, but the parser runs globally and before it, so an authenticated
 * non-admin must be rejected here before a byte is written to disk.
 */
function hasAuthenticatedAdmin(): boolean {
  try {
    return getCurrentUserSafely()?.role === 'admin'
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

  // Guide chapter 11, future entrypoint: each upload streams from the request
  // into the filesystem `uploadHandler`, so a large file is never buffered.
  let parseUploadNewForm = createUploadFilesParser()

  return async (context, next) => {
    let isUploadAction = context.url.pathname === uploadsActionPath
    let isUploadNewAction = context.url.pathname === uploadNewActionPath
    let isUploadRequest = isUploadAction || isUploadNewAction

    // The parser is global because it also feeds `context.formData` to every
    // urlencoded form. On an upload action, reject an unauthenticated
    // multipart request before `formData()` reads the body so it cannot fill
    // storage or make the parser buffer a large request. Auth runs earlier in
    // the root chain for exactly this guard; route-level requireAuth still
    // owns the normal login redirect.
    if (
      isMultipartForm(context.request) &&
      isUploadRequest &&
      context.method === 'POST' &&
      (!hasAuthenticatedUser() || (isUploadNewAction && !hasAuthenticatedAdmin()))
    ) {
      return new Response('Unauthorized', {
        status: 401,
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    if (isMultipartForm(context.request) && isUploadRequest && !isAllowedUploadOrigin(context)) {
      return new Response('Forbidden', {
        status: 403,
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    let parse = isUploadNewAction
      ? parseUploadNewForm
      : isUploadAction
        ? parseUploadForm
        : parseForm

    try {
      return await parse(context, next)
    } catch (error) {
      if (context.method === 'POST' && isUploadRequest) {
        let code = uploadLimitErrorCode(error)
        if (code != null) {
          // A file parsed before the offending part was already stored. The DB
          // route leaves its unclaimed row to retention pruning; the filesystem
          // route keeps the already-stored entry. Redirect so the banner is
          // rendered on a GET — the same path the frame reloads after a
          // submitted form action.
          let indexUrl = isUploadNewAction ? uploadNewIndexUrl : uploadsIndexUrl
          return redirect(`${indexUrl}?uploadError=${code}`)
        }
      }
      throw error
    }
  }
}
