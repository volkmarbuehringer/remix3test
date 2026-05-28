<!-- Context: development/remix3/packages/concepts | Priority: medium | Version: 1.0 | Updated: 2026-04-02 -->

# Concept: MIME

**Purpose**: MIME type detection and content-type helpers. Maps extensions to MIME types with charset and compressibility checks.

**Key Points**:
- Detect MIME types from extensions and filenames
- Build Content-Type values with charset handling
- Check compressibility for compression middleware
- Built from mime-db
- Custom MIME type registration

**Minimal Example**:
```ts
import { detectMimeType, isCompressibleMimeType, mimeTypeToContentType } from 'remix/mime'

detectMimeType('txt') // 'text/plain'
detectMimeType('file.txt') // 'text/plain'

isCompressibleMimeType('text/html') // true
isCompressibleMimeType('image/png') // false

mimeTypeToContentType('text/css') // 'text/css; charset=utf-8'
```

**Reference**: https://github.com/remix-run/remix/tree/main/packages/mime