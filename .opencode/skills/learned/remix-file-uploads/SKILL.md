---
name: remix-file-uploads
description: Handle file uploads with streaming multipart parsing and pluggable storage backends. Activate when building upload endpoints, parsing multipart forms, or storing uploaded files locally, on S3, or in PostgreSQL bytea.
---

# Remix File Uploads — PostgreSQL bytea Backend

For the streaming multipart parser, size limits, and the pluggable storage backends (`remix/file-storage/fs`, `s3`, `memory`), see the vendor READMEs: `~/remix/packages/multipart-parser/README.md`, `~/remix/packages/form-data-parser/README.md`, `~/remix/packages/file-storage/README.md`, and `~/remix/packages/form-data-middleware/README.md`.

This skill only documents the hard-won delta: storing files directly in a PostgreSQL `bytea` column, the middleware-ordering gotcha it exposes, and the streaming-parser error-handling pattern (reject-without-throwing + wrapping `formData()` for never-suppressed limit errors).

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
import { db } from '../db.ts'

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

    let result = await db.exec(
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
  await db.exec(`UPDATE uploads SET uploaded_by = $1 WHERE id = $2`, [user.id, Number(uploadedId)])
}
```

> The repo's scope carries an **array** of ids (`uploadedIds: string[]`, `addUploadedId` / `takeUploadedIds`) so one multipart request can store many files — each accepted file calls `addUploadedId(id)`, and the controller claims the whole batch in one quota check.

### 5. Download endpoint

Use a standalone `createAction` route — not nested inside `form()`:

```typescript
// routes.ts
export const uploadsDownload = get('/uploads/:id/download')

// router.ts
router.get(uploadsDownload, uploadsDownloadHandler)

// Handler
let result = await db.exec(`SELECT filename, mime_type, data FROM uploads WHERE id = $1`, [id])
// Return data as Response with Content-Type + Content-Disposition
return new Response(result.rows[0].data, {
  headers: {
    'Content-Type': result.rows[0].mime_type,
    'Content-Disposition': `attachment; filename="${result.rows[0].filename}"`,
  },
})
```

### 6. Reject a file without throwing — return `void` + record the reason

Never throw inside `uploadHandler` for an expected rejection (unsupported type, invalid name, too large) — a throw escapes the global `formData()` middleware into an uncaught 500 (see §7). Return `void` and record a reason in the upload-claim scope instead:

```typescript
export async function uploadHandler(file: FileUpload): Promise<string | void> {
  if (file.fieldName !== 'file') return
  if (!allowed(file)) { setUploadError('Dateityp nicht erlaubt.'); return } // no throw
  if (totalBytes > MAX) { await reader.cancel(); setUploadError('Datei zu groß.'); return }
  let id = await insertUpload(...)
  addUploadedId(id)      // scope holds an ARRAY → supports many files per request
  return id
}
```

Detection is by request shape, never `instanceof File` (which is always `false` for a file part): `takeUploadedIds().length === 0` **and** `Content-Type` starts with `multipart/` → the upload was rejected. Claim a whole multi-file batch in one quota check (`claimUploads(ids, userId)`), so a near-quota user can't slip files through by claiming last.

### 7. Multipart limit errors are NEVER suppressed — wrap the global `formData()`

`suppressErrors: true` only swallows malformed-body parse errors; multipart **limit** errors (`MaxFileSizeExceededError`, `MaxFilesExceededError`, `MaxPartsExceededError`, `MaxTotalSizeExceededError`) always propagate. And since `runMiddleware` has no catch, a throw inside `formData()` prevents the rest of the chain (auth, db, render, controller) from running, so the controller can't render a friendly page — you get an uncaught 500 + stack trace.

Wrap `formData()` and short-circuit with a `Response` (you cannot "continue" the chain after a downstream middleware throws). For the uploads POST, Post/Redirect/Get to the same path resolved as a GET, carrying an `uploadError` code:

```typescript
export function uploadFormData(): Middleware<{ key: typeof FormData; value: FormData; property: 'formData' }> {
  let parse = formData({ uploadHandler, maxFileSize: 50 * 1024 * 1024 })
  const action = routes.uploads.action.href()      // POST path, also valid as GET (frame commits it)
  return async (context, next) => {
    try { return await parse(context, next) }
    catch (error) {
      if (context.method === 'POST' && context.url.pathname === action) {
        let code = limitErrorCode(error)           // instanceof checks that map to stable codes
        if (code != null) return redirect(`${action}?uploadError=${code}`)   // PRG → GET renders the banner
      }
      throw error
    }
  }
}
```

⚠️ **Keep the `Middleware<{ key: typeof FormData; value: FormData; property: 'formData' }>` context transform on the wrapper.** A bare `Middleware` (default empty transform) drops it and `context.formData` stops existing in the derived `AppContext` — every consumer across the app fails tsc with TS2339 'Property `formData` does not exist'.

Keep `maxFileSize` on `formData()`: it is your per-part **memory bound** (removing it lets the parser buffer an unbounded file → OOM). Enforce the product limit in the handler (return `void`); files over the `maxFileSize` cap surface through the wrapper's redirect.

## References

- `~/remix/packages/multipart-parser/README.md` — streaming parser, limits, low-level API
- `~/remix/packages/form-data-parser/README.md` — higher-level FormData parsing middleware
- `~/remix/packages/file-storage/README.md` — storage interface and built-in backends
- `~/remix/packages/file-storage-s3/README.md` — S3 backend
- `~/remix/packages/form-data-middleware/README.md` — middleware that exposes `get(FormData)` in request context
- `~/remix/demos/` — demo apps with upload examples
- `remix-frame-binary-download` — serving binary downloads through Frame navigation
