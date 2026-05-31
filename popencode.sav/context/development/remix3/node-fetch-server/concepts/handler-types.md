<!-- Context: development/remix3/node-fetch-server/concepts | Priority: high | Version: 1.0 | Updated: 2026-05-20 -->

# Concept: Handler Types

**Purpose**: Core type definitions for the node-fetch-server API.

## Core Idea

Three interfaces define the request handling contract: `FetchHandler` (the main handler), `ClientAddress` (client identity), and `ErrorHandler` (error recovery).

## Key Points

- `FetchHandler` takes `(request: Request, client?: ClientAddress)` → `Response | Promise<Response>`
- `ClientAddress` provides `address` (IP string), `family` (`'IPv4' | 'IPv6'`), and `port` (number)
- `ErrorHandler` receives `(error: unknown)` → `void | Response | Promise<void | Response>` — can return a custom error Response
- Handler arity determines whether `client` is provided: 2-arg handlers get it, 1-arg handlers don't

## Quick Example

```ts
import type { FetchHandler, ClientAddress } from 'remix/node-fetch-server'

let handler: FetchHandler = async (request, client) => {
  let ip = client.address
  return Response.json({ message: `Hello from ${ip}` })
}
```

## Reference

- Source: `~/remix/packages/node-fetch-server/src/lib/fetch-handler.ts`

## Related

- `concepts/server-architecture.md` — How types connect to createRequestListener
- `lookup/options.md` — onError as ErrorHandler
