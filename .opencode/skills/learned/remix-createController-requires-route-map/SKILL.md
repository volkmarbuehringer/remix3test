---
name: remix-createController-requires-route-map
description: "Use createAction not createController for single post()/get()/put()/del() routes in Remix 3"
user-invocable: false
origin: auto-extracted
---

# Remix 3: createController Requires a RouteMap, Not a Single Route

**Extracted:** 2026-06-04
**Context:** When defining single-method routes (e.g., `post('logout')`) in `routes.ts` and trying to create a controller for them.

## Problem

Using `createController()` on a route defined with `post()`, `get()`, `put()`, or `del()` produces a TypeScript type error because these create a single `Route`, not a `RouteMap`:

```
error TS2345: Argument of type 'Route<"POST", "/auth/logout">' is not assignable to parameter of type 'RouteMap<string>'.
```

Similarly, `router.map()` rejects the resulting `Controller`:

```
error TS2345: Argument of type 'Controller<...>' is not assignable to parameter of type 'Action<Route<"POST", "/auth/logout">, ...>'.
```

## Solution

Single-method routes need `createAction` (not `createController`) and `router.post()`/`router.get()` (not `router.map()`):

```typescript
// routes.ts
export const routes = route({
  auth: route('auth', {
    logout: post('logout'),
  }),
})

// controller.tsx — CORRECT
import { createAction } from 'remix/router'
import { routes } from '../../routes.ts'

export const authLogout = createAction(routes.auth.logout, () => {
  let session = getContext().session
  session.unset('auth')
  return new Response(null, { status: 302, headers: { Location: routes.home.href() } })
})

// router.ts — CORRECT
router.post(routes.auth.logout.href(), authLogout)

// ❌ WRONG — createController fails on single routes
// createController(routes.auth.logout, { actions: { action() {} } })
// router.map(routes.auth.logout, logoutController)
```

## When to Use

- Adding a standalone `post()`, `get()`, `put()`, or `del()` route that doesn't belong to a larger route map controller
- Refactoring auth/logout or search endpoints defined as single-method leaves
- When `router.map()` type errors mention "Route not assignable to RouteMap"
