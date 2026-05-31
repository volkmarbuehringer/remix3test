---
name: remix-file-uploads
description: Handle file uploads with streaming multipart parsing and pluggable storage backends. Activate when building upload endpoints, parsing multipart forms, or storing uploaded files locally or on S3.
---

# Remix File Uploads

Covers `remix/multipart-parser`, `remix/form-data-parser`, `remix/file-storage`, `remix/file-storage/fs`, `remix/file-storage/s3`, `remix/file-storage/memory`.

## Multipart Parsing

Parse file uploads without buffering entire payloads:

```ts
import { parseMultipartRequest, MultipartParseError, MaxFileSizeExceededError } from 'remix/multipart-parser'

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
  maxFileSize: 10 * 1024 * 1024,    // per file
  maxParts: 100,                     // max parts
  maxTotalSize: 25 * 1024 * 1024,   // total body
})
```

## File Storage

Key/value API for `File` objects with multiple backends:

```ts
import { createFsFileStorage } from 'remix/file-storage/fs'
let storage = createFsFileStorage('./uploads')

await storage.set('avatar', file)
let saved = await storage.get('avatar')  // returns File | null
await storage.remove('avatar')
```

Backends: `remix/file-storage/fs` (local disk), `remix/file-storage/s3` (S3), `remix/file-storage/memory` (testing).

## References

- `~/remix/packages/multipart-parser/README.md` — streaming parser, limits, low-level API
- `~/remix/packages/form-data-parser/README.md` — higher-level FormData parsing middleware
- `~/remix/packages/file-storage/README.md` — storage interface and built-in backends
- `~/remix/packages/file-storage-s3/README.md` — S3 backend
- `~/remix/packages/form-data-middleware/README.md` — middleware that exposes `get(FormData)` in request context
- `~/remix/demos/` — demo apps with upload examples
