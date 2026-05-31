<!-- Context: project-intelligence/my_app/guides/request-context-usage | Priority: high | Version: 1.0 | Updated: 2026-05-07 -->

# Request Context Patterns in my_app

**Purpose**: How my_app reads values from `RequestContext` — the `AppController` pattern, `getContext()` vs action param `get()`, auth utilities, and null-check conventions.

## AppController Type

Defined in `app/router.ts` and used by every controller. Binds the middleware stack into controller context types so `get(X)` returns `T` instead of `T | undefined`:

```typescript
// router.ts
export type RootMiddleware = [
  ReturnType<typeof formData>,
  ReturnType<typeof session>,
  ReturnType<typeof loadDatabase>,
  ReturnType<typeof loadAuth>,
]

export type AppContext<params extends AnyParams = {}> = WithParams<
  MiddlewareContext<RootMiddleware>,
  params
>

export type AppController<routes extends RouteMap> = Controller<routes, AppContext>
```

**Effect**: In a controller action, `get(FormData)` returns `FormData` (not `FormData | undefined`) because `RootMiddleware` declares that `formData()` runs before any handler.

### Usage in Controllers

All 11 controllers in `app/actions/*/controller.tsx` import and use `AppController`:

```typescript
import type { AppController } from '../../router.ts'
import type { routes } from '../../routes.ts'

export default {
  actions: { /* ... */ },
} satisfies AppController<typeof routes.chat>
```

**Never import `Controller` from `remix/fetch-router`** — always use the local `AppController` from `app/router.ts`.

## getContext() vs Action Param get()

Both access `RequestContext` but through different entry points:

| Aspect | Action `{ get }` Param | `getContext()` from `async-context-middleware` |
|--------|----------------------|------------------------------------------------|
| Scope | Inside controller action handler | Anywhere in async call stack (utilities, helpers) |
| Type inference | `AppController` binds types → `get(X)` returns `T` | Returns `RequestContext` directly → `get(X)` returns `T \| undefined` |
| Null check needed? | Only when middleware might not run (e.g., guards) | Always — framework shows `T \| undefined` |
| Example | `async action({ get }) { let fd = get(FormData) }` | `let auth = getContext().get(Auth)` |

### When to Use Each

- **Action param `get`**: Default choice for controller action handlers. Benefits from `AppController` type narrowing.
- **`getContext()`**: For utility functions outside controller actions, e.g., `getCurrentUser()` in `app/utils/context.ts`. Always add null check since type is `T | undefined`.

## Auth Context Utilities

`app/utils/context.ts` provides two helpers using `getContext()` with null checks:

```typescript
// Guaranteed auth — throws if not authenticated
export function getCurrentUser(): User {
  let auth = getCurrentAuth()
  if (!auth.ok) {
    throw new Error('Expected authenticated user. Make sure requireAuth() runs before this code.')
  }
  return auth.identity
}

// Safe auth — returns null if not authenticated
export function getCurrentUserSafely(): User | null {
  let auth = getCurrentAuth()
  return auth.ok ? auth.identity : null
}

// Internal helper with null guard
function getCurrentAuth(): AuthState<User> {
  let auth = getContext().get(Auth)
  if (auth == null) {
    throw new Error('Auth not found in request context. Make sure auth() middleware runs first.')
  }
  return auth as AuthState<User>
}
```

## Null-Check Pattern in Middleware

Auth middleware (`app/middleware/auth.ts`):

```typescript
// passwordProvider.parse() — checks FormData availability
let formData = context.get(FormData)
if (formData == null) {
  throw new Error('Expected formData() middleware before password auth provider')
}

// passwordProvider.verify() — uses get(Database) instead of context.db
let db = context.get(Database)
if (db == null) {
  throw new Error('Expected database middleware before password auth provider')
}
```

Admin middleware (`app/middleware/admin.ts`):

```typescript
let auth: AuthState<User> | undefined = context.get(Auth)
if (auth == null) {
  throw new Error('Expected auth() middleware before requireAdmin()')
}
```

## Error Message Convention

All null-check errors follow: `'Expected {middleware} middleware before {consumer}'`

| File | Consumer | Expected Middleware |
|------|----------|-------------------|
| `middleware/auth.ts:42` | password auth provider (parse) | `formData()` |
| `middleware/auth.ts:53` | password auth provider (verify) | `database()` |
| `middleware/admin.ts:11` | requireAdmin() | `auth()` |
| `utils/context.ts:25` | getCurrentAuth() | `auth()` |

## Key Files

| File | Pattern | What It Shows |
|------|---------|---------------|
| `app/router.ts` | `AppController` / `AppContext` / `RootMiddleware` | Central type definitions |
| `app/actions/chat/controller.tsx` | `satisfies AppController<typeof routes.chat>` | Controller usage pattern |
| `app/middleware/auth.ts` | `context.get(FormData)`, `context.get(Database)` | Middleware null guards |
| `app/middleware/admin.ts` | `context.get(Auth)` | Middleware null guard |
| `app/utils/context.ts` | `getContext().get(Auth)` | Utility null guard |
| `app/actions/auth-login/controller.tsx` | `getContext().get(Session)` | getContext() in controllers |

## Related

- `../../../development/remix3/middleware/concepts/request-context-get-pattern.md` — Null-check pattern concept
- `../../../development/remix3/routing/concepts/controller-architecture.md` — AppController type system
- `../../../development/remix3/guides/typed-context.md` — Context typing alternatives
- `./ui-component-patterns.md` — Component patterns in my_app
