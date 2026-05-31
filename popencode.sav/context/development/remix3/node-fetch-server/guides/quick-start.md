<!-- Context: development/remix3/node-fetch-server/guides | Priority: high | Version: 1.0 | Updated: 2026-05-20 -->

# Guide: Quick Start

**Purpose**: Set up a basic HTTP server using `createRequestListener`.

## Prerequisites

- `remix/node-fetch-server` installed (included with `remix`)
- `node:http`, `node:https`, or `node:http2`

## Steps

1. **Basic HTTP server**

```ts
import { createRequestListener } from 'remix/node-fetch-server'
import * as http from 'node:http'

let server = http.createServer(
  createRequestListener(async (request) => {
    return new Response('Hello from Remix!')
  })
)
server.listen(3000)
```

2. **Access client info** (2-arg handler)

```ts
import { type FetchHandler } from 'remix/node-fetch-server'

let handler: FetchHandler = async (request, client) => {
  console.log(`Request from ${client.address}:${client.port}`)
  return Response.json({ yourIp: client.address })
}
```

3. **Streaming response**

```ts
let stream = new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode('Chunk 1\n'))
    controller.enqueue(new TextEncoder().encode('Chunk 2\n'))
    controller.close()
  }
})
return new Response(stream)
```

4. **Custom hostname / protocol**

```ts
createRequestListener(handler, {
  host: 'api.example.com',
  protocol: 'https:',
})
```

5. **HTTPS server**

```ts
import * as https from 'node:https'
import { readFileSync } from 'node:fs'

let server = https.createServer(
  { key: readFileSync('key.pem'), cert: readFileSync('cert.pem') },
  createRequestListener(handler)
)
```

## Verification

```bash
curl http://localhost:3000
# Hello from Remix!
```

## Related

- `concepts/server-architecture.md` — Handler arity and dispatch
- `concepts/handler-types.md` — FetchHandler, ClientAddress types
- `concepts/request-response.md` — Conversion internals
