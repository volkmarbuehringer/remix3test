---
name: remix-controllers
description: 'Remix 3 controllers and middleware — createController vs createAction, typed context keys, generic edge cases, controller consolidation, and error-centralization test shifts'
user-invocable: false
origin: consolidated
---

# Remix 3 Controllers & Middleware Patterns

**Consolidated from:** `remix-createContextKey-property-middleware`, `remix-createController-generic-helper-edge-case`, `remix-createController-requires-route-map`, `remix-consolidate-controllers`, `remix-middleware-error-centralization`

Covers five aspects of Remix 3 controllers and middleware:
1. Choosing `createController` vs `createAction` based on the route type
2. Using `createContextKey` (not `Symbol`) for typed middleware context properties
3. Keeping explicit generics on `createController()` when passing typed context to helpers
4. The mechanical process for consolidating flat controller directories
5. Test failures caused by moving error handling into middleware

---

## Part 1: createController Requires a RouteMap, Not a Single Route

### Problem

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

---

## Part 2: Use createContextKey not Symbol for Middleware Context Properties

### Problem

When adding custom middleware that should expose a typed property on the request context (e.g. `context.mailer`), using `Symbol` as the context key causes TypeScript errors:

```ts
// ❌ Does NOT work
export const Mailer = Symbol('mailer')
context.set(Mailer, sendEmail, { property: 'mailer' })
// Error: Symbol is not assignable to parameter of type 'object'
```

The Remix type system expects context keys to be `object` types, and `Symbol` is a `symbol`, not an `object`.

### Solution

Use `createContextKey` from `remix/router` to create a typed context key, then use it with `Middleware<{ key; value; property }>` and `context.set()`:

```ts
import { createContextKey, type Middleware } from 'remix/router'

// 1. Create a typed context key
const MailerContext = createContextKey<SendEmailFn>()

// 2. Use with Middleware generic and property name
export function mailer(): Middleware<{
  key: typeof MailerContext
  value: SendEmailFn
  property: 'mailer' // ← becomes accessible as context.mailer
}> {
  let sendEmail = createSendEmail(transport)
  return async (context, next) => {
    context.set(MailerContext, sendEmail, { property: 'mailer' })
    return next()
  }
}
```

The `property` name automatically becomes a typed property on the context. No `declare module` augmentation needed.

### Reference: app/middleware/json-render.ts

```ts
const JsonRenderer = createContextKey<(data: unknown, init?: ResponseInit) => Response>()

export function json(): Middleware<{
  key: typeof JsonRenderer
  value: (data: unknown, init?: ResponseInit) => Response
  property: 'json'
}> {
  return (context, next) => {
    context.set(JsonRenderer, (data, init) => Response.json(data, init), { property: 'json' })
    return next()
  }
}
// Enables: context.json({ ok: true })
```

### Avoiding Circular Dependencies

When deriving `AppContext` from `createMiddleware()`, placing the middleware factory in `router.ts` and re-exporting its type from `types/context.ts` creates a circular dependency:

```
router.ts → controllers → types/context.ts → router.ts
```

TypeScript silently resolves `AppContext` to `DefaultContext` — middleware-provided properties (`context.formData`, `context.auth`, `context.render`) disappear from the type system.

**Solution: One-directional dependency flow** — place `createNewappMiddleware()` in a file with no dependency on `router.ts` or controllers:

```
app/middleware/root.ts         ← createNewappMiddleware() lives here
app/types/context.ts           ← imports from root.ts, derives AppContext
app/router.ts                  ← imports from both
```

Dependency flow:

```
router.ts → middleware/root.ts + types/context.ts → middleware/*.ts
```

```typescript
// app/middleware/root.ts
// Imports only from remix/* and sibling middleware — NO router/controller imports
import { createMiddleware } from 'remix/router'
import { formData } from 'remix/middleware/form-data'
import { loadDatabase } from './database.ts'
import { loadAuth } from './auth.ts'

export function createNewappMiddleware(cookie: Cookie, storage: SessionStorage) {
  return createMiddleware(formData(), session(cookie, storage), loadDatabase(), loadAuth())
}
```

```typescript
// app/types/context.ts — type-only import, erased at runtime
import type { MiddlewareContext } from 'remix/router'
import type { createNewappMiddleware } from '../middleware/root.ts'
export type AppContext = MiddlewareContext<ReturnType<typeof createNewappMiddleware>>
```

```typescript
// app/router.ts — no cycle
import { createRouter } from 'remix/router'
import { createNewappMiddleware } from './middleware/root.ts'
import type { AppContext } from './types/context.ts'
```

**When to use:** Migrating to `createMiddleware()`, when the factory accepts parameters, whenever `export type { AppContext } from '../router.ts'` appears in `context.ts`, or if TypeScript reports "Property 'formData' does not exist on type 'RequestContext<{}...'" after refactoring.

---

## Part 3: Explicit Generics Required on createController() with Typed Helpers

### Problem

After configuring `RouterTypes.context` to resolve to `AppContext` (making explicit generics on `createController()` redundant), removing the generic from files that pass `context.auth` to a typed helper function produces a TypeScript error:

```
error TS2345: Argument of type 'GoodAuth<unknown>' is not assignable
to parameter of type 'AuthState<User> | undefined'
```

This happens because removing the generic causes `context.auth` to resolve as `GoodAuth<unknown>` instead of `GoodAuth<User>`. The `User` type parameter doesn't propagate through `MiddlewareContext` folding — only the top-level context type is fixed by `DefaultContext`.

### Solution

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

### When to Use

- You're removing explicit `<typeof routes.x, AppContext>` generics from `createController()` calls
- The controller passes `context.auth` (or other middleware-provided typed properties) to a helper function with a specific type parameter (e.g., `getAdminIdentity(auth: AuthState<User>)`, `logAdminAction(pool, { ...getAdminIdentity(context.auth) ... })`)
- Inline `context.auth` usage (e.g., `let auth = context.auth; if (!auth?.ok) ...`) works fine without the generic — only helper function calls break

---

## Part 4: Controller Consolidation (Mechanical Process)

### Problem

Flat kebab-case controller directories (`app/actions/auth-login/controller.tsx`, `app/actions/admin-chatlog/`) work correctly but produce `remix doctor` "does not match any route map" warnings and scatter related logic across many directories. Consolidating sub-route controllers into the parent's `controller.tsx` as named exports requires handling naming conflicts, import deduplication, type exports, and router updates.

### Step 1: Plan the consolidation

Identify which flat dirs map to which parent:

```
Flat dir              Route key              Parent dir
auth-login/           routes.auth.login      auth/
admin-chatlog/        routes.admin.chatlog   admin/
admin-offerings/      routes.verwaltung.offerings  verwaltung/
agent/                routes.ai.agent        ai/
```

Count total lines of all source controllers to anticipate file size.

### Step 2: Identify naming conflicts

When merging multiple controllers, scan for:

**Constant conflicts** — same name used in multiple files with different values:

```
PAGE_SIZE = 5    (chatlog)
PAGE_SIZE = 15   (users)       → must rename each uniquely
PAGE_SIZE = 12   (offerings)
```

Prefix with controller name: `CHATLOG_PAGE_SIZE`, `USERS_PAGE_SIZE`, `OFFERINGS_PAGE_SIZE`.

**Type conflicts** — same type name with different shapes:

```
interface ResourceOption { id: string; description: string }     // offerings
interface ResourceOption { id: number; description: string }     // offering-configs
```

Rename: `OfferingsResourceOption`, `OfferingConfigResourceOption`.

**Schema conflicts** — same `createSchema`/`updateSchema` in multiple controllers:
Rename: `appointmentCreateSchema`, `appointTypeCreateSchema`.

### Step 3: Merge imports

Collect all imports from source files by category (remix, app modules, UI), deduplicate. Remove UI-only imports (`Handle`, `css`, `theme`, page components) if extracting pages to `pages.tsx`.

### Step 4: Check for external type consumers

UI files may import types from the flat controller paths:

```typescript
// Old — fails after deleting flat dir:
import type { AppointmentRow, ResourceOption } from '../actions/admin-appointments/controller.tsx'

// New — point to consolidated file with renamed types:
import type {
  AppointmentRow,
  AppointmentResourceOption,
} from '../actions/verwaltung/controller.tsx'
```

Add `export` to all type interfaces that UI files consume. Search: `grep -r "from.*<old-path>" app/ui/`.

### Step 5: Convert defaults to named exports

```typescript
// Before (in separate files):
export default createController(routes.auth.login, { ... })  // auth-login/controller.tsx
export default createController(routes.auth.register, { ... }) // auth-register/controller.tsx

// After (in parent controller.tsx):
export const authLogin = createController(routes.auth.login, { ... })
export const authRegister = createController(routes.auth.register, { ... })
```

The parent route keeps its default export only if it's the only one (otherwise all become named).

### Step 6: Update router.ts

Replace individual imports with a single consolidated import:

```typescript
// Before:
import loginController from './actions/auth-login/controller.tsx'
import registerController from './actions/auth-register/controller.tsx'

// After:
import { authLogin, authRegister } from './actions/auth/controller.tsx'
```

Update all route mappings to use the new names.

### Step 7: Delete flat directories and relocate tests

```bash
git rm -r app/actions/auth-login/

# Restore test files to new location:
git show HEAD:app/actions/auth-login/controller.test.ts > app/actions/auth/auth-login.test.ts
```

### Step 8: Extract page components (if applicable)

If controllers have inline page components (common for auth, uncommon for admin), extract them to `pages.tsx`:

```typescript
// controller.tsx:
import { LoginPage } from './pages.tsx'

// pages.tsx:
export function LoginPage(handle: Handle<LoginPageProps>) { ... }
```

UI-only imports (`Handle`, `css`, `theme`, page building blocks) move to `pages.tsx`; business logic imports stay in `controller.tsx`.

### Step 9: Verify

```bash
npm run typecheck    # catches missing imports, wrong type names
npm run lint         # catches const/let issues
```

### Step 10: Understand remix doctor false warnings

After consolidation, `remix doctor` may produce false-positive warnings like:

```
[WARN] Action controller app/actions/admin-appointments/controller.tsx does not match any route map.
[WARN] Directory app/actions/auth does not match any route-map key path.
```

**These are benign.** The doctor's heuristics expect flat `*-controller.tsx` filenames in `app/actions/`, not `directory/controller.tsx`. All routes work correctly via `router.ts` explicit mapping. Confirm with:

```bash
npm run typecheck    # passes — imports resolve
npm test             # passes — routes work
```

---

## Part 5: Middleware Error Centralization Test Shift

### Problem

When you centralize error handling (body parsing, validation, auth) from individual controllers into shared middleware, existing tests break in non-obvious ways:

```
Before:           After:
┌──────────┐      ┌──────────────┐
│ Controller│     │  Middleware   │ ← new error source
│ try/catch │     │ parse body    │
│ return 400│     │ return 400    │
└──────────┘      └──────────────┘
                        │
                   ┌──────────┐
                   │ Controller│
                   │ body ready│
                   └──────────┘
```

Common test failures:

1. **Wrong status code** — test sends bad JSON expecting 200 + error body, now gets 400 from middleware
2. **Wrong error format** — middleware returns `{ error: "..." }` but controller returned `{ errors: [...] }`
3. **Wrong error location** — test asserts on controller-specific side effects (logging, DB writes) that no longer happen because middleware short-circuits
4. **Missing header checks** — test validates Content-Type in controller; middleware now handles it, but the handler has no guard and `undefined` body causes runtime errors
5. **Null body storage** — test sends non-JSON Content-Type with JSON body; middleware skips parsing, body is `undefined`, but controller tries to `JSON.stringify(undefined)` which returns `undefined` (the value, not the string), causing DB constraint violations

### Solutions

#### 1. Guard against undefined body in controllers

When middleware conditionally parses (only on matched Content-Type), controllers must handle the case where no body was parsed:

```ts
// ❌ Before — body was always set by try/catch
let body = await request.json()

// ✅ After — middleware may have skipped
let body = context.get(JsonBody)
if (!body) {
  return new Response('Expected JSON body', { status: 400 })
}
```

#### 2. Check test assertions against middleware-level responses

Tests that send invalid payloads now hit middleware, not the controller. Update assertions:

```ts
// ❌ Before — test checked controller-specific response
assert.equal(response.status, 422) // controller-level error

// ✅ After — middleware returns its own status
assert.equal(response.status, 400) // middleware-level error
```

#### 3. Keep defense-in-depth for streaming/chunked bodies

`Content-Length` is not present in chunked transfer encoding. Middleware that checks `Content-Length` for size limits can be bypassed. If controllers have existing post-parse size checks, keep them as defense-in-depth:

```ts
// Middleware: checks Content-Length (can be bypassed with chunked)
if (contentLength > maxSize) return 413

// Controller: re-checks serialized size (defense-in-depth)
let serialized = JSON.stringify(body)
if (serialized.length > MAX_SIZE) return 413 // keep this
```

#### 4. Update tests that check Content-Type rejection

Tests that send non-JSON Content-Type expecting controller-level rejection must be updated when middleware handles it:

```ts
// ❌ Before — controller checked Content-Type, returned 400
await POST('/webhook', { headers: { 'Content-Type': 'text/plain' } })
assert.equal(response.status, 400)

// ✅ After — middleware skips parse, controller returns 400
// OR middleware rejects earlier with different format
```

---

## When to Use

- Adding a standalone `post()`, `get()`, `put()`, or `del()` route that doesn't belong to a larger route map controller
- When `router.map()` type errors mention "Route not assignable to RouteMap"
- When `createAction` produces TS2344 mentioning `index` and `action` — switch to `createController`
- Adding a form page with GET + POST handling via `form()` in routes.ts
- Adding custom middleware that exposes a typed function or value on `context`
- Removing explicit generics from `createController()` while passing `context.auth` to typed helpers
- Consolidating feature directories following the timeboxer demo pattern
- Debugging `remix doctor` output after refactoring controllers
- Refactoring controller-level error handling into shared middleware, when existing tests unexpectedly fail

## Related Skills

- `remix-middleware-error-centralization` behavior is covered in Part 5 above
- `remix-route-relocation` — moving routes between route trees (frame ↔ top-level)
- `remix-createController-requires-route-map` covered in Part 1 above
- `~/remix/packages/render-middleware/README.md` — wiring request-scoped renderers into the router
