---
title: Multipart Parser Errors
category: errors
type: context
source: /home/lucky/remix/packages/multipart-parser/src/index.ts
tags: [remix3, errors, multipart, parser, file-upload]
---

# Multipart Parser Errors

## Core Concept
Common errors when using Remix's multipart parser for file uploads, including size limits and malformed payloads. Includes debugging steps.

## Common Errors

### Max File Size Exceeded (413 Payload Too Large)
❌ **Wrong**:
```ts
// No size limit configured
parseMultipart(request)
// Upload 20MB file → 413 error
```

✅ **Correct**:
```ts
parseMultipart(request, {
  maxFileSize: 10_000_000, // 10MB limit
  onError: (error) => console.error('Upload error:', error),
})
```

### Malformed Multipart Boundaries (400 Bad Request)
Caused by missing/invalid `Content-Type: multipart/form-data; boundary=...` header.

✅ **Fix**:
```ts
// Validate request before parsing
if (!isMultipartRequest(request)) {
  return new Response('Invalid content type', { status: 400 })
}
```

### Aborted Uploads (Hung Connections)
✅ **Handle aborted requests**:
```ts
try {
  const parts = await parseMultipart(request)
} catch (error) {
  if (error instanceof MultipartParseError) {
    request.signal.onabort = () => cleanupTempFiles()
  }
}
```

## Reference
- [RFC 7578 Section 4.1](https://datatracker.ietf.org/doc/html/rfc7578#section-4.1)
