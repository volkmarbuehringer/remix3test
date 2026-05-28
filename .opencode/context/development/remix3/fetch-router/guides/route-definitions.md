<!-- Context: development/remix3/fetch-router/guides/route-definitions | Priority: medium | Version: 1.0 -->

# Route Definitions — Patterns, Objects, and Shorthands

Define routes with plain strings, method+pattern objects, or pre-parsed `RoutePattern` instances. Verb shorthands (`get`, `post`, etc.) create typed single-route objects.

## Key Points

- **String pattern**: `get('/users')` → `Route<'GET', '/users'>`. Method defaults to route-map context or `ANY`.
- **Method+pattern object**: `{ method: 'POST', pattern: '/contact' }` — explicit HTTP method on a per-route basis.
- **`RoutePattern` instances**: Pass pre-parsed patterns from `route-pattern` directly.
- **Verb shorthands** (`remix/routes`): `get('/path')`, `post('/path')`, `put('/path')`, `patch('/path')`, `del('/path')`, `head('/path')`, `options('/path')` — all return `Route<'METHOD', pattern>`.
- **`del`** is aliased from `delete` (reserved word).

## Example

```ts
import { get, post, put, del } from 'remix/routes'

let r = route({
  list: get('/users'),        // Route<'GET', '/users'>
  create: post('/users'),     // Route<'POST', '/users'>
  update: put('/users/:id'),  // Route<'PUT', '/users/:id'>
  remove: del('/users/:id'),  // Route<'DELETE', '/users/:id'>
})

// Register on router:
router.get(r.list, handler)
router.post(r.create, handler)
```

## Reference

- Source: `~/remix/packages/fetch-router/src/lib/route-map.ts`
- Import: `import { get, post, put, patch, del, head, options } from 'remix/routes'`

## Related

- [Route Maps](../concepts/route-maps.md) — Compound route maps with `route()`
- [Form Routes](form-routes.md) — `form()` shorthand for GET+POST pairs
- [Resource Routes](resource-routes.md) — `resources()` and `resource()` RESTful helpers
