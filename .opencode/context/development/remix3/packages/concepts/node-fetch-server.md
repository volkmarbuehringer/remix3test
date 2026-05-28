<!-- Context: development/remix3/packages/concepts | Priority: high | Version: 1.0 | Updated: 2026-04-02 -->

# Concept: Node Fetch Server

**Purpose**: Build Node.js servers with web-standard Fetch API primitives. Converts Node's HTTP interfaces to Request/Response flows.

**Key Points**:
- Standard Request/Response APIs
- Works with node:http and node:https modules
- Streaming support with ReadableStream
- Custom hostname configuration
- Client info access (IP, port)
- Full TypeScript support

**Minimal Example**:
```ts
import * as http from 'node:http'
import { createRequestListener } from 'remix/node-fetch-server'

async function handler(request) {
  let url = new URL(request.url)
  if (url.pathname === '/api/users') {
    return Response.json({ users: [] })
  }
  return new Response('Not Found', { status: 404 })
}

let server = http.createServer(createRequestListener(handler))
server.listen(3000)

// With client info
let handler2 = async (request, client) => {
  console.log(`Request from ${client.address}:${client.port}`)
  return Response.json({ ip: client.address })
}
```

**Reference**: https://github.com/remix-run/remix/tree/main/packages/node-fetch-server