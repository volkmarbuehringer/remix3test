<!-- Context: development/remix3/packages/servers | Priority: medium | Version: 1.0 | Updated: 2026-04-25 -->

# node-fetch-server

Build HTTP servers on Node.js using the web Fetch API.

## Core Idea

Node.js server adapter that accepts standard `Request` objects and returns `Response` objects, enabling fetch-router usage on Node.

## Key Points

- **Fetch API Server**: Works with any fetch-compatible router
- **HTTP/2 Support**: Optional HTTP/2 with ALPN
- **Middleware Stack**: Built-in middleware for common patterns

## Quick Example

```ts
import { createServer } from 'node:http'
import { createNodeFetchServer } from 'remix/node-fetch-server'
import { createRouter } from 'remix/fetch-router'
import { route } from 'remix/fetch-router/routes'

let router = createRouter()
router.get(route({ home: '/' }), () => new Response('Hello'))

let server = createNodeFetchServer({ router })

createServer(server).listen(3000)
```

## Reference

`/home/lucky/remix/packages/node-fetch-server/README.md`