# Controller Routing and Types

## What This Covers

Choosing the right controller form and keeping the handler `context` typed. Read this when the task involves:

- `createController` vs `createAction` and the matching router call
- `form()` routes (virtual `index` + `action` sub-routes)
- Explicit generics on `createController()` when passing `context.auth` to a typed helper
- Typing helper params with `Pick<AppContext, ...>` instead of the whole `AppContext`

For typed context keys and dependency flow, see `context-keys-and-dependency-flow.md`. For consolidating controllers, see `controller-consolidation.md`.

## createController Requires a RouteMap, Not a Single Route

Using `createController()` on a route defined with `post()`, `get()`, `put()`, or `del()` produces a TypeScript type error because these create a single `Route`, not a `RouteMap`:

```
error TS2345: Argument of type 'Route<"POST", "/auth/logout">' is not assignable to parameter of type 'RouteMap<string>'.
```

Similarly, `router.map()` rejects the resulting `Controller`:

```
error TS2345: Argument of type 'Controller<...>' is not assignable to parameter of type 'Action<Route<"POST", "/auth/logout">, ...>'.
```

### Solution

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

### Complementary Pattern: `form()` Routes Need `createController`

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

| Route type                             | Controller                                              | Router call                             |
| -------------------------------------- | ------------------------------------------------------- | --------------------------------------- |
| `get()` / `post()` / `put()` / `del()` | `createAction` (single handler)                         | `router.get()` / `router.post()` / etc. |
| `form()`                               | `createController` (`actions.index` + `actions.action`) | `router.map()`                          |

## Explicit Generics Required on createController() with Typed Helpers

After configuring `RouterTypes.context` to resolve to `AppContext` (making explicit generics on `createController()` redundant), removing the generic from files that pass `context.auth` to a typed helper function produces a TypeScript error:

```
error TS2345: Argument of type 'GoodAuth<unknown>' is not assignable
to parameter of type 'AuthState<User> | undefined'
```

This happens because removing the generic causes `context.auth` to resolve as `GoodAuth<unknown>` instead of `GoodAuth<User>`. The `User` type parameter doesn't propagate through `MiddlewareContext` folding — only the top-level context type is fixed by `DefaultContext`.

**Keep the explicit generic on `createController()`** in any file that passes `context.auth` to a helper function expecting `AuthState<User>`:

```typescript
// ❌ BROKEN — context.auth becomes GoodAuth<unknown>
export default createController(routes.admin.users, {
  middleware: [requireAuth(), requireAdmin()],
  actions: {
    async destroy(context) {
      // getAdminIdentity expects AuthState<User>, gets GoodAuth<unknown>
      let identity = getAdminIdentity(context.auth) // TS error
    },
  },
})

// ✅ CORRECT — explicit generic preserves the User type
export default createController<typeof routes.admin.users, AppContext>(routes.admin.users, {
  middleware: [requireAuth(), requireAdmin()],
  actions: {
    async destroy(context) {
      let identity = getAdminIdentity(context.auth) // GoodAuth<User> — OK
    },
  },
})
```

**Alternative: fix the source, not the call site.** If `requireAuth()` wraps `requireAuthenticatedUser` without a type argument, the identity type defaults to `unknown` and every gated controller sees `GoodAuth<unknown>`. Pass the identity type through the app's own wrapper once:

```typescript
// app/middleware/auth.ts — global fix, no per-controller generics needed
return requireAuthenticatedUser<User>({ ... })   // <-- the fix
```

This makes `context.auth` resolve to `GoodAuth<User>` in every controller using `requireAuth()`, removing the need for explicit `createController<typeof routes.x, AppContext>` generics for the auth case. Verified in the type-safe-controller-context change: after this fix, 16 redundant `context.auth as { identity: User }` casts in `appointment/controller.tsx` and 4 in `appointments-new/controller.tsx` were deleted. The explicit-generic approach above remains valid when other middleware-provided properties need typing and no wrapper owns the type.

Use when removing explicit `<typeof routes.x, AppContext>` generics, when the controller passes `context.auth` (or other middleware-provided typed properties) to a helper with a specific type parameter, or when inline `context.auth` usage works but helper calls break (only helper function calls need the generic).

## Whole `AppContext` Not Assignable from Handler Contexts — Use `Pick` Slices

Typing a helper parameter as the whole `context: AppContext` and passing the `createController` handler's `context` fails even though every property matches:

```
error TS2345: Argument of type 'RequestContextWithEntries<{}, [...]>' is not
assignable to parameter of type 'RequestContext<{}, [...]>'.
  The types returned by 'get(...)' are incompatible between these types.
    Type 'GoodAuth<{...User...}>' is not assignable to type
    '(data: unknown, init?: ResponseInit) => Response'.
```

**Root cause:** `MiddlewareContext` exposes a heavily-overloaded `get(key)` method whose return type depends on the context entry keys. When a controller declares its own middleware (`middleware: [requireAuth(), ...]`), the handler context's `auth` entry becomes `GoodAuth<User>` (from `requireAuth`) instead of `AuthState<User>` (from root `loadAuth`), so the `get()` overload set differs from `AppContext`'s. TypeScript rejects the whole-object assignment via method variance even though every `property:` entry matches. Whole `AppContext` params only work for route handlers registered without controller middleware (e.g. `router.get(...)` with `createAction`).

**Solution:** type helper params as a `Pick<AppContext, ...>` of exactly the members used. `Pick` selects only the `property:` entries (db, url, session, render, request, auth, logger), which are identical between the handler context and `AppContext`, so assignment is clean:

```typescript
// ❌ Whole AppContext — fails via get() method variance
async function loadPageData(context: AppContext, ...) { ... }

// ✅ Pick of used members — property-based, assignable
async function loadPageData(context: Pick<AppContext, 'db' | 'session' | 'url'>, ...) { ... }
// single-member: { render: AppContext['render'] }, { url: AppContext['url'] }, db: AppContext['db']
```

TS flags a member you use but forgot to include in the Pick ("Property 'auth' does not exist on type 'Pick<...>'"), so the slice stays honest. Verified: the initial `context: AppContext` pass produced 60 errors across 10 controllers; the `Pick` pass compiles with zero.

Use when writing a helper that receives `context` from a `createController` handler, replacing `context: any`, or when a whole-`AppContext` param fails with "The types returned by 'get(...)' are incompatible".
