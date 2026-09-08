/**
 * Client-safe upload policy constants and validators, shared by the server
 * multipart handler (app/middleware/uploads.ts) and the uploads grid client
 * entries so browser-side validation never drifts from what the server enforces.
 *
 * Everything here is pure (no Node or DOM APIs) so it can be imported from a
 * remix/ui clientEntry.
 */

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

export const ALLOWED_MIME_TYPES = new Set([
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

export type ClientFile = {
  name: string
  type: string
  size: number
}

function filePolicyError(file: ClientFile): string | null {
  let ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0]
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) return 'Dateityp nicht erlaubt.'
  if (!ALLOWED_MIME_TYPES.has(file.type)) return 'Dateityp nicht erlaubt.'
  if (file.name.replace(/[/\\]/g, '_') !== file.name) return 'Ungültiger Dateiname.'
  if (file.size > MAX_UPLOAD_BYTES) {
    return 'Eine Datei überschreitet die maximale Größe von 50 MB.'
  }
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
  if (files.length > MAX_UPLOAD_FILES) {
    return 'Zu viele Dateien in einem Upload (maximal 20).'
  }
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

/** Format a byte count as a short human-readable size, e.g. `1.4 MB`. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
