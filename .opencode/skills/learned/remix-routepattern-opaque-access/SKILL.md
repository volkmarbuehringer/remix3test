---
name: remix-routepattern-opaque-access
description: "Use when `RoutePattern` access fails after it becomes opaque in Remix 3 — use `.source`/`.toJSON()`, not `.pathname.tokens`."
origin: auto-extracted
---

# RoutePattern Opaque Type — Migration Warning

**Extracted:** 2026-06-19
**Revalidated:** 2026-09-11 against `remix` 3.0.0-rc.2 (`@remix-run/route-pattern` d7eb6b18, `src/lib/route-pattern.ts:80`).
**Context:** When a remix update makes `RoutePattern` opaque (hides internal `pathname.tokens` / `_parts`)

## Problem

Code that accesses `route.pattern.pathname.tokens` directly to inspect a route's internal token structure breaks after RoutePattern becomes an opaque type. The internal `tokens` array, `WeakMap`-stored parsed parts, and brand symbol are no longer accessible.

```ts
// ❌ Breaks — pathname.tokens is now inaccessible
let tokens = route.pattern.pathname.tokens
```

## Migration

Migrating from remix v3.0.0-beta.4 to beta.5+ made RoutePattern opaque (still true on the current 3.0.0-rc.2). The public API surface is:
- `route.pattern.source` — normalized string (also `toString()`)
- `route.pattern.toJSON()` — serialized `protocol`/`hostname`/`port`/`pathname`/`search` parts
- `getRoutePatternCaptures(route.pattern)` — `{ part: 'hostname' | 'pathname', type: ':' | '*', name, optional }[]` in source order (the supported way to inspect variables/wildcards without touching internals)

The parsed internals (`_parts`, `pathname.tokens`) are underscore-prefixed/not part of the public API. See `~/remix/packages/route-pattern/README.md`. The migration delta here is the string-based rewrite technique for the common parent-path case:

**Before** (token walking):

```ts
function routeParentPath(route) {
  let tokens = route.pattern.pathname.tokens
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (tokens[i].type === ':' || tokens[i].type === '*') {
      let path = ''
      for (let j = 0; j < i; j++) {
        let t = tokens[j]
        if (t.type === 'text') path += t.text
        else if (t.type === 'separator') path += '/'
      }
      return path
    }
  }
}
```

**After** (string-based):

```ts
function routeParentPath(route) {
  return route.pattern.source.replace(/\/[:*][^/]*$/, '/')
}
```

## When to Use

- TypeScript typecheck errors mentioning `RoutePattern` property inaccessibility after updating remix
- Code that accesses `route.pattern._parts`, `route.pattern.pathname.tokens`, or `route.pattern.hostname.tokens`
- Migrating from remix v3.0.0-beta.4 (or any build where `RoutePattern` became opaque)
- You need the pattern's variables/wildcards: use `getRoutePatternCaptures(pattern)` rather than reaching into `_parts`
