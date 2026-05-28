<!-- Context: development/remix3/node-fetch-server/guides | Priority: medium | Version: 1.0 | Updated: 2026-05-20 -->

# Guide: Low-Level API

**Purpose**: Use `createRequest` + `sendResponse` directly for custom middleware or non-standard server setups.

## Prerequisites

- Understanding of `node:http` `IncomingMessage` / `ServerResponse`
- Familiarity with `concepts/request-response.md`

## Steps

1. **Manual request/response handling**

```ts
import { createRequest, sendResponse } from 'remix/node-fetch-server'
import type { IncomingMessage, ServerResponse } from 'node:http'

function handler(req: IncomingMessage, res: ServerResponse) {
  let request = createRequest(req, res, { host: 'example.com' })
  let response = new Response(`URL was: ${request.url}`)
  sendResponse(res, response)
}
```

2. **Custom error handling**

```ts
import { createRequestListener } from 'remix/node-fetch-server'

function onError(error: unknown) {
  console.error('Caught:', error)
  return new Response('Custom error page', { status: 500 })
}

http.createServer(
  createRequestListener(handler, { onError })
).listen(3000)
```

3. **Express migration** — Replace Express middleware pattern:

```ts
// Express: req, res, next
app.use((req, res, next) => { ... })

// Remix: createRequest + sendResponse
import { createRequest, sendResponse } from 'remix/node-fetch-server'

function middleware(req: IncomingMessage, res: ServerResponse) {
  let request = createRequest(req, res)
  // ... process request
  sendResponse(res, new Response('OK'))
}
```

## Verification

- Server starts without errors
- Custom error handler returns your custom page on failures
- `createRequest` produces a proper web Request with correct URL

## Related

- `concepts/request-response.md` — Conversion internals
- `concepts/server-architecture.md` — How createRequestListener uses these
- `lookup/options.md` — Option reference
