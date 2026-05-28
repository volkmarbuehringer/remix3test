<!-- Context: development/remix3/node-fetch-server/concepts | Priority: high | Version: 1.0 | Updated: 2026-05-20 -->

# Concept: LazyRequest

**Purpose**: Deferred body materialization for improved performance.

## Core Idea

`LazyRequest` is a `Request` subclass that defers full `Request` construction until a property is actually accessed. Body reading methods (`text()`, `json()`, `arrayBuffer()`, `blob()`, `bytes()`) have optimized paths that read from the Node.js stream directly without creating a full `Request` first.

## Key Points

- Uses `#materialize()` to lazily create the underlying `Request` on first property access
- Body reads skip `Request` construction entirely — read directly from Node.js stream
- `bodyUsed` tracks both materialized `Request` body usage and lazy reads
- Exceptions: `headers`, `method`, `url` proxy through lazy access; everything else triggers materialization
- `clone()` forces immediate materialization
- Two implementations: `LazyRequest` class (explicit factory) and `BoundLazyRequest` (closure-based, more optimized)
- Buffer accumulation: single buffer for small payloads, concatenation for large payloads

## Quick Example

```ts
// createRequest returns a LazyRequest — body not parsed yet
let request = createRequest(req, res)

// Only now does the body get read from the Node stream
let data = await request.json()
```

## Reference

- Source: `~/remix/packages/node-fetch-server/src/lib/lazy-request.ts`

## Related

- `concepts/request-response.md` — How createRequest returns LazyRequest
