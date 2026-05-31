<!-- Context: development/remix3/guides/server-setup | Priority: high | Version: 1.0 | Updated: 2026-05-05 -->

# Guide: Server Setup with Graceful Shutdown

**Core Idea**: The template uses `remix/node-fetch-server` with `node:http` and includes graceful shutdown for SIGINT/SIGTERM.

## Minimal Server (Template Default)

```typescript
import * as http from 'node:http'
import { createRequestListener } from 'remix/node-fetch-server'
import { router } from './app/router.ts'

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 44100

const server = http.createServer(
  createRequestListener(async (request) => {
    try {
      return await router.fetch(request)
    } catch (error) {
      console.error(error)
      return new Response('Internal Server Error', { status: 500 })
    }
  }),
)

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`)
})
```

## With Graceful Shutdown

```typescript
let shuttingDown = false

function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  server.close(() => process.exit(0))
  server.closeAllConnections()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
```

## Key Patterns

| Concern | Pattern |
|---------|---------|
| **Default port** | `44100` (Remix convention, configurable via `PORT` env) |
| **Error handling** | Catch-all in request listener returns 500, never crashes process |
| **Graceful shutdown** | Debounced flag + `closeAllConnections()` |
| **Signal handling** | `SIGINT` (Ctrl+C) and `SIGTERM` (container/k8s) |

## Production Considerations

- **Swap to `remix/node-serve`** for managed server lifecycle, TLS, uWebSockets.js
- **Add compression middleware** to router, not server layer
- **Add logging middleware** before production deployment
- **Remove error catch-all** or upgrade to structured error responses

## Reference

- Template: `~/remix/template/server.ts`
- Node fetch server: `concepts/node-fetch-server.md`
- Middleware setup: `guides/middleware-stack.md`
