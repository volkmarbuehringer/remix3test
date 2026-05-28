<!-- Context: development/remix3/node-fetch-server/concepts | Priority: critical | Version: 1.0 | Updated: 2026-05-20 -->

# Concept: Request/Response Conversion

**Purpose**: How Node.js HTTP messages are converted to/from web-standard Request/Response.

## Core Idea

`createRequest(req, res, options?)` converts `IncomingMessage` → web `Request`, and `sendResponse(res, response)` converts web `Response` → `ServerResponse`. Together they bridge Node.js and Fetch API.

## Key Points

- **URL construction**: `{protocol}//{host}{req.url}` — protocol from socket encryption or `options.protocol`, host from `options.host` or Host header or `:authority` pseudo-header
- **Body**: ReadableStream from `req` data events with `duplex: 'half'` (GET/HEAD skip body)
- **Signal**: AbortController aborted on socket close, released on finish
- **Set-Cookie**: Sent as separate headers (not comma-joined) for HTTP correctness
- **HTTP/1 vs HTTP/2**: HTTP/1 uses `writeHead(status, statusText, headers)`, HTTP/2 omits statusText
- **Streaming**: Body piped via `response.body.getReader()` with backpressure via `drain` events
- **HEAD requests**: No body sent

## Quick Example

```ts
import { createRequest, sendResponse } from 'remix/node-fetch-server'
import type { IncomingMessage, ServerResponse } from 'node:http'

function handler(req: IncomingMessage, res: ServerResponse) {
  let request = createRequest(req, res)
  let response = new Response(`Echo: ${req.url}`)
  sendResponse(res, response)
}
```

## Reference

- Source: `~/remix/packages/node-fetch-server/src/lib/request-listener.ts`

## Related

- `concepts/server-architecture.md` — High-level createRequestListener
- `concepts/lazy-request.md` — Deferred request materialization
- `guides/low-level-api.md` — Using createRequest + sendResponse directly
