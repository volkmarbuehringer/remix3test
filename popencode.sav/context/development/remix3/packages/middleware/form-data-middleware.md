<!-- Context: development/remix3/packages/middleware | Priority: high | Version: 1.0 | Updated: 2026-04-25 -->

# form-data-middleware

Parse request body form data into FormData and expose via context.

## Core Idea

Middleware that parses `multipart/form-data` and `application/x-www-form-urlencoded` bodies once per request, making them available via `context.get(FormData)`.

## Key Points

- **Form Parsing**: `FormData` available via `context.get(FormData)`
- **File Access**: Uploaded files via `formData.get(name)` or `formData.getAll(name)`
- **Upload Handler**: Custom handler for file processing
- **Limits**: `maxFiles`, `maxFileSize`, `maxParts`, `maxTotalSize`
- **Error Suppression**: `suppressErrors: true` for malformed data

## Quick Example

```ts
import { formData } from 'remix/form-data-middleware'

let router = createRouter({
  middleware: [formData()],
})

router.post('/upload', async (context) => {
  let formData = context.get(FormData)
  let name = formData.get('name')
  let avatar = formData.get('avatar') // File object
  return Response.json({ name, hasFile: avatar instanceof File })
})
```

## Custom Upload Handler

```ts
import { writeFile } from 'node:fs/promises'

let router = createRouter({
  middleware: [
    formData({
      async uploadHandler(upload) {
        let path = `./uploads/${upload.name}`
        await writeFile(path, Buffer.from(await upload.arrayBuffer()))
        return path
      },
      maxFileSize: 10 * 1024 * 1024, // 10MB
    }),
  ],
})
```

## Reference

`/home/lucky/remix/packages/form-data-middleware/README.md`