---
title: Web Standards API Reference
category: lookup
type: context
source: .tmp/external-context/remix/web-standards.md
tags: [remix3, lookup, web-standards, request, response]
---

# Web Standards API Reference

## Core Concept
Remix 3 uses web-standard `Request`/`Response` objects matching MDN specifications. No Node-specific APIs required for request/response handling.

## Supported Web APIs

| API | Support | Usage |
|-----|---------|-------|
| `Request`/`Response` | Full | Handler params and returns |
| `ReadableStream` | Full | Streaming responses (SSE) |
| `FormData` | Full | `await request.formData()` |
| `URL`/`URLSearchParams` | Full | `new URL(request.url)` |
| `Headers` | Full | `request.headers.get()` |
| `request.json()` | Full | Parse JSON bodies |
| `request.text()` | Full | Parse text bodies |
| `Response.json()` | Full | Return JSON responses |

## Example
```ts
async function handler(request: Request): Promise<Response> {
  let url = new URL(request.url)
  if (request.method === 'POST') {
    let data = await request.json()
    return Response.json({ success: true, data })
  }
  return new Response(`Query: ${url.searchParams.get('q')}`)
}
```

## Reference
- MDN Request: https://developer.mozilla.org/en-US/docs/Web/API/Request
- MDN Response: https://developer.mozilla.org/en-US/docs/Web/API/Response
