---
name: remix-response-helpers
description: Build correct HTTP responses with `remix/response/*` — file serving, HTML, redirects, and compression. Activate when returning files, HTML, redirects, or compressing response bodies.
---

# Remix Response Helpers

Covers `remix/response/file`, `remix/response/html`, `remix/response/redirect`, `remix/response/compress`.

## File Responses

Full HTTP semantics: ETags, Last-Modified, conditional requests, Range support:

```ts
import { createFileResponse } from 'remix/response/file'
import { openLazyFile } from 'remix/fs'

let response = await createFileResponse(openLazyFile('./public/image.jpg'), request, {
  cacheControl: 'public, max-age=3600',
  etag: 'weak',       // 'weak' | 'strong' | false
  lastModified: true,
  acceptRanges: true,
})
```

## HTML Responses

Auto-prepends `<!DOCTYPE html>` and sets correct Content-Type:

```ts
import { createHtmlResponse } from 'remix/response/html'
createHtmlResponse('<h1>Hello</h1>')
// Content-Type: text/html; charset=UTF-8
// Body: <!DOCTYPE html><h1>Hello</h1>
```

Works with strings, `SafeHtml` (from `remix/html-template`), Blobs, Streams.

## Redirect Responses

```ts
import { createRedirectResponse } from 'remix/response/redirect'

createRedirectResponse('/login')           // 302
createRedirectResponse('/new-page', 301)   // custom status
createRedirectResponse('/dashboard', { status: 303, headers: { 'X-Reason': 'auth' } })
```

## Compression

```ts
import { compressResponse } from 'remix/response/compress'
let compressed = await compressResponse(response, request)
// Auto-negotiates br/gzip/deflate, skips already-compressed and Range responses
```

## References

- `~/remix/packages/response/README.md` — full API, all four helpers with options
- `~/remix/packages/fs/README.md` — `openLazyFile` and filesystem helpers
- `~/remix/packages/lazy-file/README.md` — streaming `LazyFile` used internally
