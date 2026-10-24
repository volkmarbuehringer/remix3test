# `RoutePattern` Is Opaque — Use the Public API

**Source:** `remix-routepattern-opaque-access`
**Extracted:** 2026-06-19
**Revalidated:** 2026-10-24 against the installed `@remix-run/route-pattern` (`RoutePattern` remains opaque on `remix` 3.1.0).

## Rule

Do not read pattern internals (`route.pattern._parts`, `route.pattern.pathname.tokens`, `route.pattern.hostname.tokens`). Use the public surface, documented in `node_modules/remix/src/route-pattern/README.md`:

- `route.pattern.source` / `toString()` — normalized pattern string
- `route.pattern.toJSON()` — serialized `protocol`/`hostname`/`port`/`pathname`/`search` parts
- `getRoutePatternCaptures(route.pattern)` — `{ part, type, name, optional }[]` for variables/wildcards, in source order

## App delta: parent path

The app's `routeParentPath()` (`app/route-labels.ts`) derives a parent path without token walking:

```ts
function routeParentPath(route: { pattern: { source: string } }): string {
  return route.pattern.source.replace(/\/[:*][^/]*$/, '/')
}
```

## When to Use

- A `RoutePattern` property stops typechecking, or code reaches into `_parts`/`tokens`.
- You need a route's variables or wildcards — `getRoutePatternCaptures()` replaces token walking.
