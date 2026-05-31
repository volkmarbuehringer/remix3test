# Response Helper Reference

## `createFileResponse(file, request, options?)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cacheControl` | `string` | — | Cache-Control header value |
| `etag` | `'weak'` / `'strong'` / `false` | `'weak'` | ETag strategy |
| `digest` | `string` | `'SHA-256'` | Hash algorithm (strong ETags) |
| `lastModified` | `boolean` | `true` | Include Last-Modified |
| `acceptRanges` | `boolean` | `true` | Support Range requests |

## `createHtmlResponse(body, init?)`

- Accepts: `string`, `SafeHtml`, `Blob`, `File`, `ArrayBuffer`, `ReadableStream`
- Auto-prepends `<!DOCTYPE html>` if missing
- Sets `Content-Type: text/html; charset=UTF-8`

## `createRedirectResponse(location, status?)`

- Accepts relative URLs (non-spec but widely supported)
- Status defaults to `302`
- Also accepts `ResponseInit` object for custom headers

## `compressResponse(response, request, options?)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `threshold` | `number` | `1024` | Min bytes (requires Content-Length) |
| `encodings` | `string[]` | `['br','gzip','deflate']` | Supported encodings |

## Reference

- Full docs: `~/remix/packages/response/README.md`
- Imports: `remix/response/file`, `remix/response/html`, `remix/response/redirect`, `remix/response/compress`
