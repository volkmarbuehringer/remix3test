<!-- Context: development/remix3/packages/concepts | Priority: high | Version: 1.1 | Updated: 2026-05-20 -->

# Concept: Form Data Middleware

**Purpose**: Form body parsing middleware. Parses incoming FormData and exposes it via `context.formData` (or `context.get(FormData)`).

**Key Points**:
- Parses request body once per request; empty FormData for GET/HEAD
- Uploaded files via `formData.get(name)` / `formData.getAll(name)` (returns File objects)
- Custom `uploadHandler(upload)` returns replacement value for the form field (save to disk, S3, etc.)
- Multipart limits: `maxHeaderSize`, `maxFiles`, `maxFileSize`, `maxParts`, `maxTotalSize`
- `suppressErrors: true` returns empty FormData on malformed body; limit violations are never suppressed

**Minimal Example**:
```ts
import { formData } from 'remix/middleware/form-data'
import { writeFile } from 'node:fs/promises'

let router = createRouter({
  middleware: [
    formData({
      maxFileSize: 10 * 1024 * 1024,
      maxHeaderSize: 8192,
      async uploadHandler(upload) {
        let path = `./uploads/${upload.name}`
        await writeFile(path, Buffer.from(await upload.arrayBuffer()))
        return path
      },
      suppressErrors: true,
    }),
  ],
})

router.post('/users', async (context) => {
  let fd = context.formData
  return Response.json({ name: fd.get('name'), avatar: fd.get('avatar') })
})
```

**Reference**: https://github.com/remix-run/remix/tree/main/packages/form-data-middleware
