---
name: remix-upload-to-postgres-bytea
description: "Stream file uploads into PostgreSQL bytea via formData({ uploadHandler }) in Remix 3"
user-invocable: false
origin: auto-extracted
---

# Remix 3: Stream File Uploads to PostgreSQL bytea

**Extracted:** 2026-06-12
**Context:** Adding a file upload route that streams files directly into a PostgreSQL `bytea` column using the `formData()` middleware's `uploadHandler`.

## Problem

You need a file upload endpoint in a Remix 3 app that stores uploaded files in a PostgreSQL `bytea` column. Using `request.formData()` buffers the entire file in memory before your action runs. The `uploadHandler` option on `formData()` middleware streams file parts during multipart parsing, but:

1. The middleware runs **before** auth/session middleware — so `context.auth` is not available
2. The handler runs per file part — you need to collect chunks manually
3. There's no built-in download endpoint for `bytea` — you must serve the binary data yourself

## Solution

### 1. Add DB migration

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

### 2. Create the upload handler

```typescript
// app/middleware/uploads.ts
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
    // Return void — file stays as in-memory File in FormData,
    // controller can detect failure and show error
    return
  }
}
```

### 3. Wire into middleware chain

```typescript
// app/middleware/root.ts
import { formData } from 'remix/middleware/form-data'
import { uploadHandler } from './uploads.ts'

export function createNewappMiddleware(cookie, storage) {
  return createMiddleware(
    // ... other middleware ...
    formData({ uploadHandler, maxFileSize: 50 * 1024 * 1024 }),
    methodOverride(),
    session(cookie, storage),
    // auth runs AFTER formData — context.auth unavailable in uploadHandler
    loadAuth(),
    // ...
  )
}
```

### 4. Handle auth in the controller (two-step)

The `uploadHandler` inserts with `uploaded_by = null` because auth runs after formData. The controller UPDATEs the row after auth is available:

```typescript
// Controller action
async action(context) {
  let user = getCurrentUser()
  let fileField = context.formData.get('file')
  let uploadId = typeof fileField === 'string' ? Number(fileField) : null

  if (uploadId && !Number.isNaN(uploadId)) {
    await pool.query(
      `UPDATE uploads SET uploaded_by = $1 WHERE id = $2`,
      [user.id, uploadId],
    )
  }

  // If uploadId is null, the uploadHandler failed or no file was sent
  let uploadError = uploadId === null || Number.isNaN(uploadId)
    ? 'Upload failed. File may be too large or a server error occurred.'
    : null
  // ... render with error/success feedback
}
```

### 5. Download endpoint serving bytea

Use a standalone route with `createAction` for the download — don't nest it inside the `form()` route:

```typescript
// routes.ts
export const uploads = form('uploads')         // GET /uploads + POST /uploads
export const uploadsDownload = get('/uploads/:id/download')  // standalone

// router.ts
import uploadsController, { download as uploadsDownloadHandler } from './actions/uploads/controller.tsx'
router.map(routes.uploads, uploadsController)
router.get(uploadsDownload, uploadsDownloadHandler)
```

The download handler reads `bytea` from DB and returns it as a `Response`:

```typescript
// Controller (createAction with middleware)
export const download = createAction(uploadsDownload, {
  middleware: [requireAuth()],
  handler: async (context) => {
    let id = Number(context.params.id)
    if (Number.isNaN(id)) return new Response('Invalid ID', { status: 400 })

    let result = await pool.query(
      `SELECT filename, mime_type, data FROM uploads WHERE id = $1`,
      [id],
    )
    if (result.rows.length === 0) return new Response('Not found', { status: 404 })

    let { filename, mime_type, data } = result.rows[0]
    let safeFilename = filename.replace(/"/g, '\\"')

    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': mime_type,
        'Content-Disposition': `attachment; filename="${safeFilename}"`,
      },
    })
  },
})
```

### 6. Error handling pattern

Errors in `uploadHandler` return `void`, keeping the file as a `File` object in `context.formData`. The controller detects this by checking `typeof fileField === 'string'` — if it's a `File`, the handler didn't process it, indicating failure.

For `MaxFileSizeExceededError`, the multipart parser throws before the handler runs. Set `maxFileSize` explicitly in `formData()` to control the limit.

## When to Use

- Building a file upload route that stores files in PostgreSQL instead of disk/S3
- Using the `formData({ uploadHandler })` middleware pattern for the first time
- Encountering the "auth not available in uploadHandler" middleware ordering issue
- Needing a download endpoint that serves `bytea` content with correct headers
- Adding an upload route alongside existing `form()` routes in a Remix 3 app

## See Also

- `remix-file-uploads` — low-level multipart parsing and file storage backends
- `remix-frame-binary-download` — serving binary downloads through Frame navigation
- `remix-createController-requires-route-map` — createAction vs createController for standalone routes
