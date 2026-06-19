---
name: remix-routepattern-opaque-access
description: "Use .source/.toJSON() not .pathname.tokens after RoutePattern becomes opaque in Remix 3"
origin: auto-extracted
---

# RoutePattern Opaque Type — Public API Access

**Extracted:** 2026-06-19
**Context:** When updating remix dependency and RoutePattern becomes opaque (hides internal `pathname.tokens`)

## Problem

Code that accesses `route.pattern.pathname.tokens` directly to inspect a route's internal token structure breaks after RoutePattern becomes an opaque type. The internal `tokens` array, `WeakMap`-stored parsed parts, and brand symbol are no longer accessible.

```ts
// ❌ Breaks — pathname.tokens is now inaccessible
let tokens = route.pattern.pathname.tokens
```

## Solution

Use the public API — `source`, `toString()`, or `toJSON()` — with string manipulation instead of token-level access.

| Public API | Returns | Example |
|---|---|---|
| `route.pattern.source` | Normalized pattern string | `/admin/fragments/user-detail/:userId` |
| `route.pattern.toString()` | Same as `.source` | `/admin/fragments/user-detail/:userId` |
| `route.pattern.toJSON().pathname` | Pathname without leading `/` | `admin/fragments/user-detail/:userId` |

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
- Code that accesses `route.pattern.pathname.tokens` or `route.pattern.hostname.tokens`
- Migrating from remix v3.0.0-beta.4 to beta.5+ where RoutePattern became opaque
