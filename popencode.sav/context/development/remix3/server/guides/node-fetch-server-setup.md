---
title: Node Fetch Server Setup
category: guides
type: context
source: .tmp/external-context/remix/node-fetch-server.md
tags: [remix3, guides, server, node, streaming]
---

# Node Fetch Server Setup

## Core Concept
Configure `remix/node-fetch-server` with `createRequestListener` for Node.js HTTP servers. Supports client info access, streaming responses, and low-level request/response control.

## Key Points
- `createRequestListener(handler)` wraps Node HTTP server with fetch API
- Handler receives `(request: Request, client)` where `client` has IP/port
- Use `ReadableStream` for streaming responses (SSE, large data)
- Low-level API: `createRequest(req, res)` and `sendResponse(res, response)`
- Works with `node:http`, `node:https`, `node:http2`

## Example: Handler with Client Info
```ts
import { type FetchHandler } from 'remix/node-fetch-server'

let handler: FetchHandler = async (request, client) => {
  console.log(`Request from ${client.address}:${client.port}`)
  return Response.json({ yourIp: client.address })
}
```

## Example: Streaming Response
```ts
let stream = new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode('Chunk 1\n'))
    controller.close()
  }
})
return new Response(stream)
```

## Reference
- Packages: `~/remix/packages/node-fetch-server/README.md`
- Related: `concepts/node-fetch-server.md`
- Server setup guide: `guides/server-setup.md`
