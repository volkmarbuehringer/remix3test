<!-- Context: development/remix3/packages/core | Priority: high | Version: 1.1 | Updated: 2026-05-20 -->

# response

Response helper utilities for common HTTP responses with correct headers and caching.

## Core Idea

No default export. Import from subpath modules: `remix/response/file`, `remix/response/html`, `remix/response/redirect`, `remix/response/compress`.

## Key Points

- **File Responses**: ETag (weak/strong/custom digests), Last-Modified, Range/partial, conditional requests, Cache-Control
- **HTML Responses**: Auto DOCTYPE, proper Content-Type, accepts string/SafeHtml/Blob/ArrayBuffer/ReadableStream
- **Redirect Responses**: Relative URLs (non-spec but widely supported), `redirect()` alias exported alongside `createRedirectResponse()`
- **Compression**: Auto-negotiate gzip/Brotli/deflate from Accept-Encoding; SSE auto-flush detection

## Quick Example

```ts
import { createFileResponse } from 'remix/response/file'
import { createHtmlResponse } from 'remix/response/html'
import { redirect } from 'remix/response/redirect'
import { compressResponse } from 'remix/response/compress'

// HTML (SafeHtml from remix/html-template also supported)
let html = createHtmlResponse('<h1>Hello</h1>')

// Redirect (alias: redirect === createRedirectResponse)
let redir = redirect('/login', 302)

// File with caching
let file = await createFileResponse(lazyFile, request, {
  cacheControl: 'public, max-age=3600',
  etag: 'weak', // 'strong' or false; digest option for custom hashing
})

// Compress response
let compressed = await compressResponse(response, request)
```

## File Response Options

```ts
await createFileResponse(file, request, {
  cacheControl: 'public, max-age=3600',
  etag: 'weak',             // 'weak' | 'strong' | false
  digest: 'SHA-256',        // Web Crypto algorithm or custom async (file) => string
  lastModified: true,       // false to omit Last-Modified
  acceptRanges: true,       // auto-disabled for compressible MIME types by default
})
```

## Compression Auto-Skip

Compression is skipped when any condition applies:
- No `Accept-Encoding` request header
- Response already compressed (`Content-Encoding` present)
- `Cache-Control: no-transform` directive
- Empty response body (or HEAD request)
- `Content-Length` below threshold (default 1024 bytes)
- Response advertises range support (`Accept-Ranges: bytes`)
- Partial content responses (206 status)

**HEAD requests**: Compression headers set but no body streamed.

## SSE Auto-Flush

For `Content-Type: text/event-stream` responses, `compressResponse` auto-applies:
- gzip/deflate: `Z_SYNC_FLUSH`
- Brotli: `BROTLI_OPERATION_FLUSH`

Set an explicit `zlib.flush` or `brotli.flush` value to override.

## Range vs Compression

Mutually exclusive. When `Accept-Ranges: bytes` is present, compression is skipped. `createFileResponse` auto-configures ranges only for non-compressible MIME types.

## Reference

`/home/lucky/remix/packages/response/README.md`
