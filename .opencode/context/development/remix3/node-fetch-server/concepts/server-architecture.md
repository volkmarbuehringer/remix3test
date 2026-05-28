<!-- Context: development/remix3/node-fetch-server/concepts | Priority: critical | Version: 1.0 | Updated: 2026-05-20 -->

# Concept: Server Architecture

**Purpose**: How `createRequestListener` wraps a fetch handler into a Node.js request listener.

## Core Idea

`createRequestListener(handler, options?)` converts a web-standard fetch handler (`(Request) => Response`) into a `(IncomingMessage, ServerResponse) => void` callback compatible with `http.createServer`, `https.createServer`, and `http2.createServer`.

## Key Points

- Handler arity determines behavior: 0 args (benchmark/health), 1 arg (Request), 2 args (Request + ClientAddress)
- Errors thrown from handler are caught and passed to `onError` (default: console.error + 500)
- Error handler itself is try/caught to prevent double-faults
- Options: `host` (override URL host), `protocol` (override protocol), `onError` (custom error handler)
- Works with `node:http`, `node:https`, `node:http2`

## Quick Example

```ts
import { createRequestListener } from 'remix/node-fetch-server'
import * as http from 'node:http'

let handler: FetchHandler = async (request) => {
  return new Response('Hello from fetch!')
}

http.createServer(createRequestListener(handler)).listen(3000)
```

## Reference

- Source: `~/remix/packages/node-fetch-server/src/lib/request-listener.ts`

## Related

- `concepts/request-response.md` — Request/Response conversion details
- `concepts/handler-types.md` — Type definitions
- `guides/quick-start.md` — Full server setup
