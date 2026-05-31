<!-- Context: development/remix3/node-fetch-server/guides | Priority: medium | Version: 1.0 | Updated: 2026-05-20 -->

# Guide: Testing

**Purpose**: Use `createTestServer` from `remix/node-fetch-server/test` to test fetch handlers.

## Prerequisites

- Import from `remix/node-fetch-server/test` (separate entry point)

## Steps

1. **Basic test server**

```ts
import { createTestServer } from 'remix/node-fetch-server/test'

let server = createTestServer(async (request) => {
  return new Response(`Hello, ${request.url}`)
})

let response = await server.fetch('http://localhost/path?name=World')
console.log(await response.text()) // Hello, /path?name=World
```

2. **Test in a test framework**

```ts
import { createTestServer } from 'remix/node-fetch-server/test'
import type { TestServer } from 'remix/node-fetch-server/test'
import { describe, it, expect } from 'node:test'

describe('my handler', () => {
  let server: TestServer

  it('returns 200', async () => {
    server = createTestServer(handler)
    let response = await server.fetch('/test')
    expect(response.status).toBe(200)
  })
})
```

## Verification

- `server.fetch()` returns a standard web `Response`
- Server is created with Node.js `http` + `createRequestListener`
- No need to manage port binding or server lifecycle manually

## Related

- `concepts/server-architecture.md` — createRequestListener used internally
- `concepts/handler-types.md` — FetchHandler signature used by test server
