# Form Data Parser

Streaming `multipart/form-data` parser. Drop-in replacement for `request.formData()` with streaming file upload handling.

## Key Points

- **Streaming**: Processes file uploads from the request body stream — minimal memory footprint
- **Upload Handler**: Define how each `FileUpload` is stored (disk, S3, R2) via callback
- **Limits**: Configurable `maxFileSize`, `maxFiles`, `maxParts`, `maxTotalSize`, `maxHeaderSize`
- **Error Types**: Specific error classes for each limit (`MaxFilesExceededError`, `MaxFileSizeExceededError`, etc.)
- **Smart Fallback**: Auto-uses native `request.formData()` for non-multipart requests

## Quick Example

```ts
import { parseFormData } from 'remix/form-data-parser'

async function uploadHandler(fileUpload) {
  if (fileUpload.fieldName === 'avatar') {
    await fsp.writeFile(`/uploads/${fileUpload.filename}`, fileUpload.bytes)
    return fileUpload.filename // store reference, not bytes
  }
}

async function handler(request: Request) {
  let formData = await parseFormData(request, uploadHandler)
  let avatar = formData.get('avatar') // filename string
}
```

## Reference

- Full docs: `~/remix/packages/form-data-parser/README.md`
- Import: `remix/form-data-parser`

## Related
- [data-schema](./data-schema.md) — Validate parsed FormData with `remix/data-schema/form-data`

- [file-storage](./file-storage.md) — Store uploaded files via file-storage API
- [form-data-middleware guide](../guides/form-data-handling.md)
