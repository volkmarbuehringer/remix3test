---
name: remix-createController-requires-route-map
description: "Use createAction for single routes, createController for form() routes in Remix 3"
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

Single-method routes need `createAction` (not `createController`) and `router.post()`/`router.get()` (not `router.map()`). Pass the Route object directly — `.href()` is unnecessary because verb methods accept Route objects natively:

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

// router.ts — CORRECT (pass Route object directly, no `.href()` needed)
router.post(routes.auth.logout, authLogout)

// ❌ WRONG — createController fails on single routes
// createController(routes.auth.logout, { actions: { action() {} } })
// router.map(routes.auth.logout, logoutController)
```

## Complementary Pattern: `form()` Routes Need `createController`

The reverse situation also occurs. `createAction()` on a route defined with `form()` produces a different error:

```
error TS2344: Type '{ index: Route<"GET", "...">; action: Route<"POST", "...">; }'
does not satisfy the constraint 'ActionRoute'.
```

`form()` creates a virtual route map with `index` (GET) and `action` (POST) sub-routes, but `createAction` expects a single `Route` object.

**Fix:** Use `createController` with `actions.index` and `actions.action`, wired via `router.map()`:

```typescript
// routes.ts
export const myFormRoute = form('/some-path')

// controller.tsx — CORRECT
import { createController } from 'remix/router'

export const myFormController = createController<typeof myFormRoute, AppContext>(
  myFormRoute,
  {
    middleware: [requireAuth()],
    actions: {
      index(context) {
        return context.render(...)
      },
      async action(context) {
        // POST handling
        return new Response(null, { status: 303, headers: { Location: '/' } })
      },
    },
  },
)

// router.ts — CORRECT
router.map(myFormRoute, myFormController)
```

### Quick reference

| Route type | Controller | Router call |
|---|---|---|
| `get()` / `post()` / `put()` / `del()` | `createAction` (single handler) | `router.get()` / `router.post()` / etc. |
| `form()` | `createController` (`actions.index` + `actions.action`) | `router.map()` |

## When to Use

- Adding a standalone `post()`, `get()`, `put()`, or `del()` route that doesn't belong to a larger route map controller
- Refactoring auth/logout or search endpoints defined as single-method leaves
- When `router.map()` type errors mention "Route not assignable to RouteMap"
- When `createAction` produces TS2344 mentioning `index` and `action` — switch to `createController`
- Adding a form page with GET + POST handling via `form()` in routes.ts
