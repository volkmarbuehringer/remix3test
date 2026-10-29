import { AsyncLocalStorage } from 'node:async_hooks'
import {
  MaxFilesExceededError,
  MaxFileSizeExceededError,
  MaxPartsExceededError,
  MaxTotalSizeExceededError,
  type FileUpload,
} from 'remix/form-data-parser/future'
import { formData } from 'remix/middleware/form-data/future'
import type { Middleware } from 'remix/router'

import { db } from '../db.ts'
import {
  insertUploadFile,
  sumUploadFileBytes,
  uploadFilesTotalQuotaBytes,
} from '../data/upload-files.ts'
import { uploadFiles } from '../storage.ts'
import { getCurrentUserSafely } from '../utils/context.ts'
import {
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_FILES,
  extensionOf,
  normalizeMimeType,
  validateUploadMetadata,
} from '../utils/upload-validation.ts'

/** Form field every file input on the streaming upload page uses. */
export const UPLOAD_FILES_FIELD = 'file'

const STORE_FAILED_MESSAGE = 'Speichern fehlgeschlagen. Bitte versuchen Sie es erneut.'
const CONTENT_MISMATCH_MESSAGE = 'Der Dateiinhalt passt nicht zum Dateityp.'
const QUOTA_EXCEEDED_MESSAGE = 'Das Speicherkontingent für Datei-Uploads ist erschöpft.'
const QUOTA_CHECK_FAILED_MESSAGE =
  'Der belegte Speicher konnte nicht geprüft werden. Bitte versuchen Sie es erneut.'

type UploadFilesState = { keys: string[]; error: string | null }

const stateStorage = new AsyncLocalStorage<UploadFilesState>()

/**
 * Establishes the per-request scope the streaming `uploadHandler` records its
 * server-generated storage keys and rejection message in. It MUST run before
 * the parser (see `app/middleware/root.ts`).
 *
 * The action reads keys from this scope instead of trusting the `file` form
 * value: the handler's return value becomes an ordinary form field that a
 * client could also submit by hand, and only keys stored by this request may
 * be reported as uploaded.
 */
export function uploadFilesScope(): Middleware {
  return (_context, next) => stateStorage.run({ keys: [], error: null }, next)
}

/** Drain the storage keys written during this request, in parse order. */
export function takeStoredFileKeys(): string[] {
  let state = stateStorage.getStore()
  if (!state) return []
  let keys = state.keys
  state.keys = []
  return keys
}

/** Drain the rejection message recorded by the upload handler, if any. */
export function takeUploadFilesError(): string | null {
  let state = stateStorage.getStore()
  if (!state) return null
  let error = state.error
  state.error = null
  return error
}

/** Shared `Content-Type` check used by the upload routes and their controller. */
export function isMultipartForm(request: Request): boolean {
  return request.headers.get('Content-Type')?.toLowerCase().startsWith('multipart/') ?? false
}

/**
 * Map a multipart limit error to the stable code carried in `?uploadError=`.
 * The stable and `/future` parser subpaths re-export the same error classes, so
 * one mapping covers both the `bytea` route and the streaming filesystem route.
 */
export function uploadLimitErrorCode(error: unknown): string | null {
  if (error instanceof MaxFileSizeExceededError) return 'file_too_large'
  if (error instanceof MaxFilesExceededError) return 'too_many_files'
  if (error instanceof MaxTotalSizeExceededError) return 'total_too_large'
  if (error instanceof MaxPartsExceededError) return 'too_many_parts'
  return null
}

/** Build the streaming multipart parser used by the `/admin/uploadnew` action. */
export function createUploadFilesParser(): Middleware<{
  key: typeof FormData
  value: FormData
  property: 'formData'
}> {
  return formData({
    uploadHandler: storeUploadedFile,
    maxFileSize: MAX_UPLOAD_BYTES,
    // The parser's default is `maxFiles * maxFileSize + 1 MiB`, so make the
    // request bound explicit instead of inheriting a ~1 GiB implicit limit.
    maxTotalSize: MAX_UPLOAD_FILES * MAX_UPLOAD_BYTES,
    maxFiles: MAX_UPLOAD_FILES,
  })
}

/**
 * Stream a single upload straight to filesystem storage (chapter 11's future
 * `formData()` flow). Returns the storage key for the form, or nothing when the
 * file was rejected.
 *
 * The future `FileUpload` can only be read once and cannot be sliced, so the
 * declared name/type are validated up front and the stored bytes are inspected
 * afterwards. A file that fails the content or quota check is removed again.
 */
async function storeUploadedFile(upload: FileUpload): Promise<string | void> {
  if (upload.fieldName !== UPLOAD_FILES_FIELD) return
  // An empty file input submits a part with an empty name; there is nothing to
  // store and it must not become a rejected "file".
  if (upload.name === '') return

  let rejection = validateUploadMetadata(upload)
  if (rejection != null) {
    setUploadFilesError(rejection)
    return
  }

  // Check the quota before reading the body. When the directory is already
  // full the handler returns without consuming the part, so nothing is
  // written.
  let usedBytes = await quotaBytesBeforeWrite()
  if (usedBytes == null) return

  let extension = extensionOf(upload.name) as string
  let key = crypto.randomUUID()

  try {
    // `set()` streams the upload to disk; nothing is buffered in memory. The
    // cast bridges Bun's global `File` type (which adds `image()`) with the
    // vendor's runtime contract, which only reads metadata and `stream()`.
    await uploadFiles.set(key, upload as unknown as File)
  } catch (error) {
    // A limit violation aborts the stream mid-write and leaves a partial
    // entry behind. Remove it, then rethrow so `uploadFormData()` can turn the
    // parser error into the `?uploadError=` redirect.
    await removeStoredFile(key)
    if (uploadLimitErrorCode(error) != null) throw error
    if (process.env.NODE_ENV !== 'test') {
      console.error('Failed to store uploaded file', error)
    }
    setUploadFilesError(STORE_FAILED_MESSAGE)
    return
  }

  // `set()` fully consumed the stream, so the size is known now. Re-check with
  // the new file included: the pre-check used the total before this write.
  if (usedBytes + upload.size > uploadFilesTotalQuotaBytes) {
    await removeStoredFile(key)
    setUploadFilesError(QUOTA_EXCEEDED_MESSAGE)
    return
  }

  if (!(await storedContentMatches(key, extension))) {
    await removeStoredFile(key)
    setUploadFilesError(CONTENT_MISMATCH_MESSAGE)
    return
  }

  // Index the file in Postgres so listing/quota/audit are queryable without a
  // BYTEA column. A failed insert must remove the already-written file.
  try {
    await insertUploadFile(db, {
      storageKey: key,
      filename: upload.name,
      mimeType: normalizeMimeType(upload.type),
      size: upload.size,
      uploadedBy: getCurrentUserSafely()?.id ?? null,
      now: Date.now(),
    })
  } catch (error) {
    await removeStoredFile(key)
    if (process.env.NODE_ENV !== 'test') {
      console.error('Failed to index uploaded file', error)
    }
    setUploadFilesError(STORE_FAILED_MESSAGE)
    return
  }

  addStoredFileKey(key)
  return key
}

/**
 * Read the bytes already recorded and reject when the quota is exhausted.
 * Returns the pre-write total, or `null` after recording an error. This is a
 * SQL aggregate over `upload_files`, not a filesystem scan.
 */
async function quotaBytesBeforeWrite(): Promise<number | null> {
  let usedBytes = await storedBytes()
  if (usedBytes == null) {
    setUploadFilesError(QUOTA_CHECK_FAILED_MESSAGE)
    return null
  }
  if (usedBytes >= uploadFilesTotalQuotaBytes) {
    setUploadFilesError(QUOTA_EXCEEDED_MESSAGE)
    return null
  }
  return usedBytes
}

function addStoredFileKey(key: string): void {
  let state = stateStorage.getStore()
  // The parser only runs behind `uploadFilesScope()`; leave the file in place
  // rather than losing data if the scope is ever misconfigured.
  if (state == null) return
  state.keys.push(key)
}

/**
 * Sum the metadata sizes of every stored entry. Returns `null` when storage
 * cannot be read, so the caller rejects the upload instead of writing blind.
 */
async function storedBytes(): Promise<number | null> {
  try {
    return await sumUploadFileBytes(db)
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Failed to measure filesystem upload storage', error)
    }
    return null
  }
}

/** Read the stored file's head back from disk and compare it to its extension. */
async function storedContentMatches(key: string, extension: string): Promise<boolean> {
  try {
    let stored = await uploadFiles.get(key)
    if (stored == null) return false

    // 16 bytes cover the longest signature (RIFF…WEBP at offset 8) with room to
    // spare; the slice is lazy, so only that prefix is read.
    let head = new Uint8Array(await stored.slice(0, 16).arrayBuffer())
    return contentMatchesExtension(head, extension)
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Failed to validate uploaded file', error)
    }
    return false
  }
}

function contentMatchesExtension(bytes: Uint8Array, extension: string): boolean {
  switch (extension) {
    case '.pdf':
      return startsWith(bytes, [0x25, 0x50, 0x44, 0x46]) // "%PDF"
    case '.png':
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])
    case '.jpg':
    case '.jpeg':
      return startsWith(bytes, [0xff, 0xd8, 0xff])
    case '.gif':
      return startsWith(bytes, [0x47, 0x49, 0x46, 0x38]) // "GIF8"
    case '.webp':
      return startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && asciiAt(bytes, 8, 'WEBP')
    default:
      // Plain-text families have no magic number; a NUL byte in the head is
      // enough to tell a text file from a binary payload.
      return !bytes.includes(0)
  }
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) return false
  return signature.every((byte, index) => bytes[index] === byte)
}

function asciiAt(bytes: Uint8Array, offset: number, value: string): boolean {
  if (bytes.length < offset + value.length) return false
  for (let index = 0; index < value.length; index++) {
    if (bytes[offset + index] !== value.charCodeAt(index)) return false
  }
  return true
}

/** Remove a partially written or rejected storage entry, ignoring absences. */
async function removeStoredFile(key: string): Promise<void> {
  try {
    await uploadFiles.remove(key)
  } catch {
    // Nothing was written (or the entry is already gone); the caller only
    // needs the side effect to have been attempted.
  }
}

function setUploadFilesError(message: string): void {
  let state = stateStorage.getStore()
  if (state == null) {
    throw new Error(
      'uploadFilesScope() must run before formData({ uploadHandler }); see app/middleware/root.ts',
    )
  }
  state.error = message
}
