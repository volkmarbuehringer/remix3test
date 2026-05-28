<!-- Context: development/remix3/fetch-router/concepts/router-architecture | Priority: high | Version: 1.0 -->

# Router Architecture — `createRouter`

The central dispatch engine. Wraps a `createMultiMatcher` trie from `route-pattern`, supports middleware chains, and routes Fetch API requests to typed handlers.

## Core Concept

`createRouter(options?)` creates a Fetch API router. Call `router.fetch(url, init?)` to dispatch a request. The router builds a `RequestContext`, runs global middleware, matches routes via the matcher, runs route/controller/action middleware, and invokes the handler. Falls back to `defaultHandler` (default: 404).

## Key Points

- **Global middleware**: Passed as `middleware: [...]` to `createRouter`. Runs on every request before route matching.
- **Matcher**: Uses `route-pattern`'s trie-based `createMultiMatcher` by default. Can be overridden via `matcher` option.
- **Route registration**: `router.get('/users', handler)`, `router.post('/users', handler)`, or `router.route('ANY', '/', handler)` for any method.
- **Controller registration**: `router.map(routes, controller)` registers all actions in a controller against corresponding route map entries.
- **Dispatch flow**: `router.fetch(url)` → create `RequestContext` → global middleware → `matcher.matchAll(url)` → filter by method → route middleware chain → handler → `defaultHandler` on miss.

## Example

```ts
let router = createRouter({
  middleware: [logger()],
  defaultHandler: (ctx) => new Response('Not Found', { status: 404 }),
})

router.get('/', (ctx) => new Response('Home'))
router.post('/data', (ctx) => new Response('Created', { status: 201 }))

let response = await router.fetch('http://localhost/')
// 'Home'
```

## Reference

- Source: `~/remix/packages/fetch-router/src/lib/router.ts`
- Import: `import { createRouter } from 'remix/router'`

## Related

- [Route Maps](route-maps.md) — Type-safe route definitions for `router.map()`
- [Middleware System](../guides/middleware.md) — How middleware integrates with dispatch
- [route-pattern: Multi Matcher](../../route-pattern/guides/multi-matcher.md) — Underlying trie matching
