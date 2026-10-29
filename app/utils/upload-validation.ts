/**
 * Client-safe upload policy constants and validators, shared by the server
 * multipart handler (app/middleware/uploads.ts) and the uploads grid client
 * entries so browser-side validation never drifts from what the server enforces.
 *
 * Everything here is pure (no Node or DOM APIs) so it can be imported from a
 * remix/component clientEntry.
 */

import { ContentType } from 'remix/headers/content-type'

/** Maximum size of a single uploaded file (bytes). Mirrors the server cap. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

/** Maximum number of files accepted in one upload request. */
export const MAX_UPLOAD_FILES = 20

export const ALLOWED_EXTENSIONS = new Set([
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

/**
 * Media types a file may declare for each allowed extension. This is the single
 * source of truth for the upload policy: the browser validation, the `bytea`
 * upload handler, and the streaming filesystem handler all use it, so a `.png`
 * declared as `text/plain` is rejected by all three instead of only the server.
 */
const EXTENSION_MEDIA_TYPES: Record<string, readonly string[]> = {
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.gif': ['image/gif'],
  '.webp': ['image/webp'],
  '.pdf': ['application/pdf'],
  '.txt': ['text/plain'],
  '.csv': ['text/csv', 'text/plain'],
  '.json': ['application/json'],
  '.xml': ['application/xml', 'text/xml'],
}

/**
 * Reduce a raw MIME type to its media type by dropping parameters such as
 * `;charset=utf-8`. Runtimes differ here — Bun's `File` constructor appends a
 * charset to text types — and a client may send a parameterized part header, so
 * the allowlist must compare the media type only.
 *
 * Parsing goes through the vendor `ContentType` parser (hardened for quoted and
 * parameterized values) instead of a hand-rolled `split(';')`, so a malformed or
 * quoted parameter cannot leak into the allowlist comparison. The parser keeps
 * the media type's original case, so lower-case it here.
 */
export function normalizeMimeType(mime: string): string {
  return ContentType.from(mime).mediaType?.toLowerCase() ?? ''
}

/** Lower-cased file extension including the dot, or `undefined`. */
export function extensionOf(name: string): string | undefined {
  return name.toLowerCase().match(/\.[^.]+$/)?.[0]
}

/**
 * Validate a file's untrusted name and declared media type against the shared
 * upload policy. Returns the German rejection reason, or `null` when allowed.
 *
 * A name is never joined to a filesystem path (storage keys are generated
 * server-side), but path-like names are still rejected so they cannot become
 * misleading metadata. Callers that stream large files must also re-check the
 * stored bytes afterwards: this only inspects metadata.
 */
export function validateUploadMetadata(file: { name: string; type: string }): string | null {
  let extension = extensionOf(file.name)
  if (extension == null || !ALLOWED_EXTENSIONS.has(extension)) return 'Dateityp nicht erlaubt.'
  if (file.name.replace(/[/\\]/g, '_') !== file.name) return 'Ungültiger Dateiname.'

  let allowedTypes = EXTENSION_MEDIA_TYPES[extension]
  if (allowedTypes == null || !allowedTypes.includes(normalizeMimeType(file.type))) {
    return 'Dateityp nicht erlaubt.'
  }

  return null
}

type ClientFile = {
  name: string
  type: string
  size: number
}

function filePolicyError(file: ClientFile): string | null {
  let error = validateUploadMetadata(file)
  if (error != null) return error
  if (file.size > MAX_UPLOAD_BYTES) return UPLOAD_TOO_LARGE_MESSAGE
  return null
}

/**
 * Validate a batch of selected files against the upload policy. Returns the
 * first German rejection reason, or `null` when the batch may be submitted.
 * The individual-file size check lives here too so oversized files fail fast
 * in the browser instead of after a server round-trip.
 */
export function validateUploadFiles(files: ClientFile[]): string | null {
  if (files.length === 0) return null
  if (files.length > MAX_UPLOAD_FILES) return UPLOAD_TOO_MANY_FILES_MESSAGE
  for (let file of files) {
    let error = filePolicyError(file)
    if (error != null) return error
  }
  return null
}

/**
 * Human-friendly label for a raw MIME type in the uploads grid, e.g.
 * `application/pdf` → `PDF`, `image/png` → `Bild`. Returns the raw MIME when no
 * friendly label is known so the column never falls back to a bare unknown.
 */
export function formatUploadType(mime: string): string {
  if (mime == null) return '—'
  if (mime.startsWith('image/')) return 'Bild'
  if (mime === 'application/pdf') return 'PDF'
  if (mime === 'text/plain') return 'Text'
  if (mime === 'text/csv') return 'CSV'
  if (mime === 'application/json') return 'JSON'
  if (mime === 'application/xml' || mime === 'text/xml') return 'XML'
  return mime
}

/**
 * German number formatting for byte values: decimal comma, no trailing `,0`
 * (`63,6 MB`, `500 MB`). Sizes are rendered in a German UI, so a dot decimal
 * reads like a thousands separator to users.
 */
const byteNumberFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 })

/** Format a byte count as a short human-readable size, e.g. `1,4 MB`. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${byteNumberFormat.format(bytes)} B`
  if (bytes < 1024 * 1024) return `${byteNumberFormat.format(bytes / 1024)} KB`
  return `${byteNumberFormat.format(bytes / (1024 * 1024))} MB`
}

/**
 * Shared rejection copy. The numeric limits are interpolated from the same
 * constants the validator (and the UI hint) use, so changing a cap updates the
 * message instead of leaving a stale literal behind.
 */
export const UPLOAD_TOO_LARGE_MESSAGE = `Eine Datei überschreitet die maximale Größe von ${formatBytes(MAX_UPLOAD_BYTES)}.`
const UPLOAD_TOO_MANY_FILES_MESSAGE = `Zu viele Dateien in einem Upload (maximal ${MAX_UPLOAD_FILES}).`

/**
 * Uploader-facing rejection reasons, keyed by the stable code the multipart
 * limit errors are mapped to and carried in the page URL. Shared by the
 * database-backed uploads grid and the filesystem-backed streaming upload page
 * so both report the same limits with the same wording.
 */
export const uploadErrorMessages: Record<string, string> = {
  file_too_large: UPLOAD_TOO_LARGE_MESSAGE,
  too_many_files: UPLOAD_TOO_MANY_FILES_MESSAGE,
  total_too_large: 'Der Upload überschreitet die maximale Gesamtgröße.',
  too_many_parts: 'Zu viele Formularfelder in der Anfrage.',
}
