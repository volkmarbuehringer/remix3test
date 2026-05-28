<!-- Context: development/remix3/packages/concepts | Priority: critical | Version: 1.2 | Updated: 2026-05-20 -->

# Concept: Response

**Purpose**: Web Fetch API response helpers — HTML, redirect, file, and compression utilities with correct headers.

## Key Points

- Web Standards compliant (works in Node, Bun, Deno, Workers)
- `createHtmlResponse(body, init)` — Auto-prepends `<!DOCTYPE html>`, sets `Content-Type: text/html`
- `createRedirectResponse(location, init)` — Relative URL support, default 302; also exported as `redirect()`
- `createFileResponse(file, request, opts)` — ETags, Last-Modified, conditional requests, Range/partial, Cache-Control
- `compressResponse(response, request, opts)` — Streaming compression (br, gzip, deflate) based on Accept-Encoding
- All functions return standard `Response` objects
- Import from subpaths: `remix/response/html`, `remix/response/redirect`, `remix/response/file`, `remix/response/compress`

## Quick Example

```ts
import { createHtmlResponse } from 'remix/response/html'
import { redirect } from 'remix/response/redirect'
import { createFileResponse } from 'remix/response/file'
import { compressResponse } from 'remix/response/compress'

let html = createHtmlResponse('<h1>Hello</h1>')
let redir = redirect('/login', 302) // also: createRedirectResponse
let file = await createFileResponse(lazyFile, request, { cacheControl: 'public, max-age=3600' })
let compressed = await compressResponse(response, request)
```

## HTML Response Details

- Accepts body types: `string`, `SafeHtml`, `Blob`/`File`, `ArrayBuffer`/`ArrayBufferView`, `ReadableStream<Uint8Array>`
- SafeHtml from `remix/html-template` — auto-escaped via tagged template literals
- Skips DOCTYPE prepend if body already starts with `<!DOCTYPE html>` (case-insensitive)
- Blob/File/ReadableStream bodies stream DOCTYPE prepended as first chunk

## Redirect Response Details

- `redirect()` is a direct alias for `createRedirectResponse()` — same signature
- Accepts relative URLs (non-spec but widely supported)
- Second param: status number (default 302) or `ResponseInit` object

## File Response Details

- Accepts native `File` or `LazyFile` (lazy stat from `remix/fs`)
- ETag strategies: `'weak'` (default, `W/"<size>-<mtime>"`), `'strong'` (SHA-256 hash), `false` (disabled)
- `digest` option: Web Crypto algorithm name (`'SHA-256'`/`'SHA-512'`) or custom async `(file) => string` function
- `lastModified: false` to omit `Last-Modified` header (default `true`)
- Conditional requests via `If-None-Match` / `If-Modified-Since` → 304, `If-Match` / `If-Unmodified-Since` → 412
- Range requests via `Range` header → 206 Partial Content
- HEAD requests return headers only (no body stream)

## Compression Details

Auto-skipped when any condition applies:
- No `Accept-Encoding` header · Already compressed · `Cache-Control: no-transform`
- Empty body (no stream) · `Content-Length < threshold` (default 1024) · `Accept-Ranges: bytes` · 206 status

Options: `threshold` (bytes), `encodings` (`['br','gzip','deflate']`), `zlib` (ZlibOptions), `brotli` (BrotliOptions)

**SSE**: For `text/event-stream`, auto-applies `Z_SYNC_FLUSH` (gzip/deflate) or `BROTLI_OPERATION_FLUSH` — overridable by explicit `flush` values.

**Range vs Compression**: Mutually exclusive. `Accept-Ranges: bytes` prevents compression.

## Reference

Source: `~/remix/packages/response/src/*.ts`
