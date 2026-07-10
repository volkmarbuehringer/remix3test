---
name: mock-http-external-service-dynamic-port
description: 'Mock external HTTP services in Remix 3 tests using node:http on port 0 with function-wrapped env vars'
user-invocable: false
origin: auto-extracted
---

# Mock External HTTP Service on Dynamic Port

**Extracted:** 2026-06-23
**Context:** When testing a Remix 3 controller that POSTs to an external HTTP service (e.g., hermes event processor), you need a mock server that doesn't collide with a real instance.

## Problem

- The real external service (e.g., hermes on `:8644`) is running during development, so binding the mock to the same port causes `EADDRINUSE`.
- Module-level `const URL = process.env.X ?? 'default'` is evaluated at import time — too early for `before()` hooks to override the env var.
- Tests silently skip the external-forwarding code path, so regressions go undetected.

## Solution

Combine two techniques:

1. **Function-wrapped env var** — read at request time, not module load time
2. **Dynamic port (port 0)** — OS assigns a free port, avoiding collisions

### Controller pattern

```ts
// Instead of a module-level const:
// const EXTERNAL_URL = process.env.EXTERNAL_URL ?? 'http://127.0.0.1:8644/endpoint'

// Use a function evaluated at request time:
function externalUrl(): string {
  return process.env.EXTERNAL_URL ?? 'http://127.0.0.1:8644/endpoint'
}

// Then in the handler:
let response = await fetch(externalUrl(), { ... })
```

### Test pattern

```ts
import { createServer } from 'node:http'

let mockServer: ReturnType<typeof createServer>

before(async () => {
  await new Promise<void>((resolve) => {
    mockServer = createServer((req, res) => {
      res.writeHead(202, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'accepted', delivery_id: 'test-123' }))
    })
    // Port 0 → OS assigns a free port, no EADDRINUSE
    mockServer.listen(0, '127.0.0.1', () => {
      let addr = mockServer.address()
      if (addr && typeof addr === 'object') {
        // Override the URL at request time via env var
        process.env.EXTERNAL_URL = `http://127.0.0.1:${addr.port}/endpoint`
      }
      resolve()
    })
  })
})

after(async () => {
  mockServer?.close()
  // Clean up env var so other tests aren't affected
  delete process.env.EXTERNAL_URL
})

// Verify the forward actually happened by checking side effects
it('forwards data and stores response status', async () => {
  let response = await router.fetch(url, { method: 'POST', ... })
  let json = await response.json()

  // Query the DB to verify the external service response was stored
  let { rows } = await pool.query('SELECT status FROM table WHERE id = $1', [json.id])
  assert.equal(rows[0].status, '202')
})
```

## When to Use

- Testing a handler that calls an external HTTP service via `fetch()`
- The real service is running locally and would collide with a mock on the same port
- You need to verify the external call happened and its response was processed correctly
- Any Remix 3, Node.js, or Deno project using the built-in HTTP server for mocks
