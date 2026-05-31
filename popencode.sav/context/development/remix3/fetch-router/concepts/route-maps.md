<!-- Context: development/remix3/fetch-router/concepts/route-maps | Priority: high | Version: 1.0 -->

# Route Maps — `route()` and `Route` class

Type-safe route definition with nested maps, base patterns, and typed `href()` generation. The `Route` class carries a `method` and `pattern` for matching.

## Core Concept

Use `route()` (aliased from `createRoutes`) to define a route map tree. Each leaf is a `Route<method, pattern>` instance with a type-safe `href()` method that generates URLs from params. Supports nesting, base prefixes, and method-override objects.

## Key Points

- **String shorthand**: `route({ home: '/' })` creates `Route<'ANY', '/'>`. Href is `/`.
- **Method+pattern object**: `{ method: 'POST', pattern: '/contact' }` creates a method-specific route.
- **Nested maps**: `route({ blog: { index: '/blog', show: '/blog/:slug' } })` creates nested route trees.
- **Base pattern**: `route('/api/v1', { users: '/users' })` prepends `/api/v1` to all child paths.
- **`Route.href()`**: Type-checked URL generation — `routes.blog.show.href({ slug: 'hello' })` → `/blog/hello`.

## Example

```ts
import { route } from 'remix/routes'

let r = route({
  home: '/',
  blog: {
    index: '/blog',
    show: '/blog/:slug',
  },
  contact: { method: 'POST', pattern: '/contact' },
})

r.home.href()                      // '/'
r.blog.show.href({ slug: 'hello' }) // '/blog/hello'
```

## Reference

- Source: `~/remix/packages/fetch-router/src/lib/route-map.ts`
- Import: `import { route } from 'remix/routes'`

## Related

- [Route Definitions](../guides/route-definitions.md) — Pattern syntax and verb shorthand helpers
- [Form Routes](../guides/form-routes.md) — `form()` shorthand for HTML form patterns
- [Resource Routes](../guides/resource-routes.md) — `resources()` and `resource()` RESTful helpers
