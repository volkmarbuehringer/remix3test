<!-- Context: development/remix3/fetch-router/guides/verb-methods | Priority: medium | Version: 1.0 -->

# Verb Methods — HTTP Method Shorthands

Register routes directly on the router with HTTP-verb-specific methods. Each matches only the corresponding request method.

## Key Points

- **Shorthands**: `router.get(path, handler)`, `router.post(path, handler)`, `router.put(path, handler)`, `router.patch(path, handler)`, `router.delete(path, handler)`, `router.head(path, handler)`, `router.options(path, handler)`.
- **`router.route(method, target, action)`**: Generic registration — `router.route('ANY', '/', handler)` matches any HTTP method.
- **Method matching**: Route is skipped if `context.method` does not match the registered method or `'ANY'`.
- **Target types**: Path string, `Route` object, or `RoutePattern` instance. Controller maps via `router.map()`.

## Example

```ts
let router = createRouter()

router.get('/', (ctx) => new Response('Home'))
router.post('/data', (ctx) => new Response('Created', { status: 201 }))
router.put('/items/:id', (ctx) => new Response('Updated'))
router.delete('/items/:id', (ctx) => new Response('Deleted'))
router.route('ANY', '/ping', (ctx) => new Response('pong'))
// Matches GET, POST, PUT, etc. — any method
```

## Reference

- Source: `~/remix/packages/fetch-router/src/lib/router.ts`
- Import: `import { createRouter } from 'remix/router'`

## Related

- [Router Architecture](../concepts/router-architecture.md) — `createRouter()` and dispatch flow
- [Route Definitions](route-definitions.md) — Verb shorthands for route map creation
- [Controllers and Actions](controllers-and-actions.md) — `router.map()` for bulk registration
