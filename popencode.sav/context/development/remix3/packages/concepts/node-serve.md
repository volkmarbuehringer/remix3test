<!-- Context: development/remix3/packages/concepts | Priority: high | Version: 1.0 | Updated: 2026-05-20 -->

# Concept: node-serve

**Purpose**: High-performance Node.js server using web-standard Fetch API primitives. Built on uWebSockets.js for maximum throughput. Supports WebSocket routes, HTTPS, client info access, and custom hostnames.

**Key Points**:
- `serve(handler, options)` — starts a managed uWebSockets.js server with Fetch API handler
- **Managed lifecycle**: `server.ready` (await startup), `server.close()` (graceful shutdown)
- **WebSocket**: `setup(app)` hook for native uWS WebSocket routes alongside Fetch handlers
- **HTTPS**: pass `tls: { keyFile, certFile }` for TLS; `request.url` defaults to `https:`
- **Client info**: handler receives `(request, client)` with `client.address`, `client.port`
- **Custom URLs**: `host` and `protocol` options for proxy/load-balancer environments
- **Adapter**: `createUwsRequestHandler(handler)` for existing uWS apps

**Minimal Example**:
```ts
import { serve } from 'remix/node-serve'

let server = serve((request) => {
  let url = new URL(request.url)
  if (url.pathname === '/') return new Response('Hello')
  return new Response('Not Found', { status: 404 })
}, { port: 3000 })

await server.ready
```

**WebSocket setup**:
```ts
serve(handler, {
  setup(app) {
    app.ws('/ws', {
      open(ws) { ws.subscribe('chat') },
      message(ws, msg) { ws.publish('chat', msg) },
    })
  },
})
```

**Reference**: `/home/lucky/remix/packages/node-serve/README.md`
