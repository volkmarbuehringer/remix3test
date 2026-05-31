<!-- Context: development/remix3/packages/concepts | Priority: high | Version: 1.0 | Updated: 2026-04-02 -->

# Concept: Form Data Parser

**Purpose**: Streaming multipart/form-data parser. Enhanced replacement for native `request.formData()` with file upload handling.

**Key Points**:
- Drop-in replacement for `request.formData()`
- Minimal buffering - streams file uploads
- Built on web Streams API and File API
- Custom upload handler for file processing
- Storage agnostic (disk, S3, R2, etc.)
- Multipart limits to prevent DoS

**Minimal Example**:
```ts
import { parseFormData } from 'remix/form-data-parser'

async function uploadHandler(fileUpload) {
  if (fileUpload.fieldName === 'avatar') {
    await saveToDisk(fileUpload.name, fileUpload.bytes)
    return fileUpload.name
  }
}

let formData = await parseFormData(request, uploadHandler)
```

**Reference**: https://github.com/remix-run/remix/tree/main/packages/form-data-parser