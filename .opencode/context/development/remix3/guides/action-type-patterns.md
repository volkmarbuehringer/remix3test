<!-- Context: development/remix3/guides/action-type-patterns | Priority: high | Version: 1.0 | Updated: 2026-05-07 -->

# Action Type Patterns

**Purpose**: Upstream type evolution for `Middleware`, `Action`, and action-level middleware composition in Remix 3's fetch-router.

## Quick Reference

| Old (removed) | New (current) | Impact |
|---------------|---------------|--------|
| `Middleware<'ANY', {}, Transform>` | `Middleware<{}, Transform>` | `_method` generic removed |
| `BuildAction<'GET', typeof routes.X>` | `Action<typeof routes.X>` | Renamed `BuildAction`→`Action`, lost method generic |
| `BuildAction<'GET', typeof routes.X, AppContext>` | `Action<typeof routes.X, AppContext>` | Context type is now the 2nd generic, not 3rd |
| Action-level `middleware` as `Middleware[]` | `typeof middleware` (const context) | Use generic 3rd param for typed middleware context |

## 1. Middleware Type Signature

The `Middleware` type in `remix/fetch-router` lost its first generic parameter (`_method`):

```typescript
// ❌ Old (removed — causes type error):
Middleware<'ANY', {}, Transform>

// ✅ New (current):
Middleware<{}, Transform>
```

This affects all middleware factories and inline middleware definitions:

```typescript
import type { Middleware } from 'remix/fetch-router'

// Database middleware
export function loadDatabase(): Middleware<{ db: Database }> {
  return async (ctx, next) => {
    ctx.set(dbKey, createDatabase(...))
    return next()
  }
}

// Auth middleware
export function requireAuth(): Middleware<{ userId: string }> {
  return async (ctx, next) => {
    let session = ctx.get(sessionKey)
    if (!session) return redirect('/login')
    ctx.set(userIdKey, session.userId)
    return next()
  }
}
```

**Codebase References**:
- `demos/frame-navigation/middleware/database.ts` — `loadDatabase()` with correct signature
- `demos/bookstore/middleware/auth.ts` — `requireAuth()` middleware
- `demos/bookstore/middleware/asset-entry.ts` — Asset-entry middleware pattern

## 2. BuildAction Renamed to Action

The `BuildAction` type is renamed to `Action`:

```typescript
// ❌ Old:
import type { BuildAction } from 'remix/fetch-router'
export const myAction: BuildAction<'GET', typeof routes.someRoute> = { handler() { ... } }

// ✅ New:
import type { Action } from 'remix/fetch-router'
export const myAction: Action<typeof routes.someRoute> = { handler() { ... } }
```

**Key changes**:
- `BuildAction` is removed — use `Action`
- The method generic (`'GET'`, `'POST'`, etc.) is no longer part of the type
- Context type (if needed) becomes the 2nd generic instead of 3rd

```typescript
// With custom context:
export const myAction: Action<typeof routes.someRoute, AppContext> = {
  handler(context) { ... }
}
```

**Codebase References**:
- `demos/bookstore/app/actions/render.tsx` — Action type usage
- `demos/frame-navigation/app/actions/render.tsx` — Action type usage

## 3. Action-Level Middleware

Actions can declare their own middleware that runs before the handler, using `Action<typeof routes.X, AppContext, typeof middleware>`:

```typescript
import type { Action } from 'remix/fetch-router'
import type { AppContext } from '../router.ts'
import { requireAuth } from '../middleware/auth.ts'

// Define middleware inline or import
const middleware = [requireAuth()] as const

const myAction = {
  middleware,
  handler(context) {
    // context is typed with middleware-injected values
    let user = context.get(UserKey)
    return Response.json({ user })
  },
} satisfies Action<typeof routes.someRoute, AppContext, typeof middleware>
```

**How it works**:
1. `middleware` is declared as `const` assertion to preserve tuple type
2. The 3rd generic (`typeof middleware`) tells TypeScript to infer injected context types
3. Handler receives fully-typed context with middleware values available

**Comparison**:

| Approach | When to use |
|----------|-------------|
| Route-level middleware in `router.map()` | Middleware runs for ALL actions on a route |
| Action-level middleware via `Action.middleware` | Middleware runs only for this specific action |
| Global middleware in `createRouter()` | Middleware runs for every request |

**Codebase References**:
- `demos/bookstore/app/actions/books/controller.tsx` — Action-level auth middleware on delete/update actions
- `demos/social-auth/app/actions/auth/controller.tsx` — Action-level middleware for OAuth callbacks

## 4. createContextKey for Typed Context Values

Use `createContextKey<T>()` from `remix/fetch-router` for type-safe context get/set instead of plain property access:

```typescript
import { createContextKey } from 'remix/fetch-router'
import type { Database } from 'remix/data-table'
import type { User } from '../schema.ts'

// Define keys
export const dbKey = createContextKey<Database>()
export const userKey = createContextKey<User>()
export const sessionKey = createContextKey<Session>()

// In middleware — set values
export function loadDatabase(): Middleware<{}> {
  return async (ctx, next) => {
    ctx.set(dbKey, createDatabase(...))
    return next()
  }
}

// In handler — get typed values
let db = context.get(dbKey)
if (db == null) throw new Error('Database middleware required')
// db is now Database (narrowed after null check)
```

> **See also**: `guides/typed-context.md` — Full guide on context augmentation, AppController, and module augmentation patterns.

## Related

- `guides/typed-context.md` — Typed context architecture (module augmentation, AppController)
- `middleware/guides/middleware-composition.md` — Middleware chain ordering and composition
- `middleware/lookup/middleware-api-reference.md` — Middleware API reference

## Codebase References

- `demos/frame-navigation/app/types/context.db.ts` — Context key definitions
- `demos/bookstore/app/types/context.ts` — AppContext type alias
- `packages/fetch-router/README.md` — Action, Middleware, createContextKey docs
