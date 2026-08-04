---
name: remix-file-uploads
description: Handle file uploads with streaming multipart parsing and pluggable storage backends. Activate when building upload endpoints, parsing multipart forms, or storing uploaded files locally, on S3, or in PostgreSQL bytea.
---

# Remix File Uploads — PostgreSQL bytea Backend

For the streaming multipart parser, size limits, and the pluggable storage backends (`remix/file-storage/fs`, `s3`, `memory`), see the vendor READMEs: `~/remix/packages/multipart-parser/README.md`, `~/remix/packages/form-data-parser/README.md`, `~/remix/packages/file-storage/README.md`, and `~/remix/packages/form-data-middleware/README.md`.

This skill only documents the hard-won delta: storing files directly in a PostgreSQL `bytea` column and the middleware-ordering gotcha it exposes.

## PostgreSQL bytea Backend

When you need to store files directly in a PostgreSQL `bytea` column instead of disk or S3, use the `formData({ uploadHandler })` middleware's streaming handler.

### 1. Migration

```sql
CREATE TABLE IF NOT EXISTS uploads (
  id SERIAL PRIMARY KEY,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  data BYTEA NOT NULL,
  size BIGINT NOT NULL,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at BIGINT NOT NULL
);
```

### 2. Upload Handler

```typescript
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
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [file.name, file.type, data, data.length, null, Date.now()],
    )
    return String(result.rows[0].id)
  } catch {
    return // stays as in-memory File — controller detects failure
  }
}
```

### 3. Wire into middleware chain

The `formData()` middleware runs **before** auth — so `uploadHandler` inserts with `uploaded_by = null` and the controller updates the row after auth:

```typescript
// root.ts — middleware order matters
formData({ uploadHandler, maxFileSize: 50 * 1024 * 1024 }),
session(cookie, storage),
loadAuth(),  // auth runs AFTER formData
```

### 4. Auth fixup in controller — use a server-side request scope, NOT the form field

⚠️ **The `file` form value is attacker-controlled.** Claiming `uploaded_by` from
`context.formData.get('file')` — even with a scoped `(uploaded_by IS NULL OR uploaded_by = $1)`
guard — lets any authenticated user steal any unclaimed upload by POSTing a plain text field
`file=<victimId>` (no file part, so `uploadHandler` never runs). See `idor-scope-write-bypass`.

Pass the server-generated id through an `AsyncLocalStorage` scope that is installed **before**
`formData()` (the handler runs during body parsing, so the scope must already exist):

```typescript
// upload-claim.ts
const storage = new AsyncLocalStorage<{ uploadedId?: string }>()
export function uploadClaimScope(): Middleware {
  return (_ctx, next) => storage.run({}, next)
}
export function setUploadedId(id: string): void {
  let state = storage.getStore()
  if (!state) throw new Error('uploadClaimScope() must run before formData()')
  state.uploadedId = id
}
export function takeUploadedId(): string | undefined {
  let state = storage.getStore()
  if (!state) return undefined
  let id = state.uploadedId
  state.uploadedId = undefined
  return id
}

// root.ts — ordering is load-bearing: uploadClaimScope BEFORE formData
uploadClaimScope(),
formData({ uploadHandler, maxFileSize: 50 * 1024 * 1024 }),

// uploadHandler — after INSERT … RETURNING id
setUploadedId(id)

// controller — claim only the server-scoped id, ignore the form field
let uploadedId = takeUploadedId()
if (uploadedId != null) {
  await pool.query(`UPDATE uploads SET uploaded_by = $1 WHERE id = $2`, [user.id, Number(uploadedId)])
}
```

### 5. Download endpoint

Use a standalone `createAction` route — not nested inside `form()`:

```typescript
// routes.ts
export const uploadsDownload = get('/uploads/:id/download')

// router.ts
router.get(uploadsDownload, uploadsDownloadHandler)

// Handler
let result = await pool.query(`SELECT filename, mime_type, data FROM uploads WHERE id = $1`, [id])
// Return data as Response with Content-Type + Content-Disposition
return new Response(result.rows[0].data, {
  headers: {
    'Content-Type': result.rows[0].mime_type,
    'Content-Disposition': `attachment; filename="${result.rows[0].filename}"`,
  },
})
```

### 6. Error handling

Errors in `uploadHandler` return `void`, keeping the file as a `File` object in `context.formData`. Detect failure: `typeof fileField === 'string'` means success (handler returned the ID), `File` means failure. For `MaxFileSizeExceededError`, set `maxFileSize` in `formData()`.

**Note (2026-08-04):** `context.formData.get('file') instanceof File` is always `false` — a file part's FormData value is whatever `uploadHandler` returned (a string id), and text parts are strings. To detect a failed upload, key off the request shape instead: `context.request.headers.get('Content-Type')?.startsWith('multipart/')` combined with `takeUploadedId() == null`.

## References

- `~/remix/packages/multipart-parser/README.md` — streaming parser, limits, low-level API
- `~/remix/packages/form-data-parser/README.md` — higher-level FormData parsing middleware
- `~/remix/packages/file-storage/README.md` — storage interface and built-in backends
- `~/remix/packages/file-storage-s3/README.md` — S3 backend
- `~/remix/packages/form-data-middleware/README.md` — middleware that exposes `get(FormData)` in request context
- `~/remix/demos/` — demo apps with upload examples
- `remix-frame-binary-download` — serving binary downloads through Frame navigation
