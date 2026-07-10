---
name: remix-file-uploads
description: Handle file uploads with streaming multipart parsing and pluggable storage backends. Activate when building upload endpoints, parsing multipart forms, or storing uploaded files locally, on S3, or in PostgreSQL bytea.
---

# Remix File Uploads

Covers `remix/multipart-parser`, `remix/form-data-parser`, `remix/file-storage`, `remix/file-storage/fs`, `remix/file-storage/s3`, `remix/file-storage/memory`, and the PostgreSQL bytea pattern.

## Multipart Parsing

Parse file uploads without buffering entire payloads:

```ts
import {
  parseMultipartRequest,
  MultipartParseError,
  MaxFileSizeExceededError,
} from 'remix/multipart-parser'

for await (let part of parseMultipartRequest(request)) {
  if (part.isFile) {
    let buffer = part.arrayBuffer
    console.log(`File: ${part.filename} (${buffer.byteLength} bytes)`)
  } else {
    console.log(`Field: ${part.name} = ${part.text}`)
  }
}
```

### Size Limits

```ts
let parts = parseMultipartRequest(request, {
  maxFileSize: 10 * 1024 * 1024, // per file
  maxParts: 100, // max parts
  maxTotalSize: 25 * 1024 * 1024, // total body
})
```

## File Storage

Key/value API for `File` objects with multiple backends:

```ts
import { createFsFileStorage } from 'remix/file-storage/fs'
let storage = createFsFileStorage('./uploads')

await storage.set('avatar', file)
let saved = await storage.get('avatar') // returns File | null
await storage.remove('avatar')
```

Backends: `remix/file-storage/fs` (local disk), `remix/file-storage/s3` (S3), `remix/file-storage/memory` (testing).

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

### 4. Auth fixup in controller

```typescript
let fileField = context.formData.get('file')
let uploadId = typeof fileField === 'string' ? Number(fileField) : null
if (uploadId && !Number.isNaN(uploadId)) {
  await pool.query(`UPDATE uploads SET uploaded_by = $1 WHERE id = $2`, [user.id, uploadId])
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

## References

- `~/remix/packages/multipart-parser/README.md` — streaming parser, limits, low-level API
- `~/remix/packages/form-data-parser/README.md` — higher-level FormData parsing middleware
- `~/remix/packages/file-storage/README.md` — storage interface and built-in backends
- `~/remix/packages/file-storage-s3/README.md` — S3 backend
- `~/remix/packages/form-data-middleware/README.md` — middleware that exposes `get(FormData)` in request context
- `~/remix/demos/` — demo apps with upload examples
- `remix-frame-binary-download` — serving binary downloads through Frame navigation
