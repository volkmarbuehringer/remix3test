<!-- Context: development/remix3/guides/middleware-composition | Priority: high | Version: 1.1 | Updated: 2026-05-07 -->

# Middleware Composition

> How to combine middleware in chains, control execution order, and choose global vs route-level middleware.

## Quick Reference

- **Use when**: Building middleware chains, protecting routes, adding cross-cutting concerns
- **Order matters**: Middleware runs in array order; earlier sets context for later
- **Global**: Runs on every request. **Route**: Runs on specific routes only
- **Type signature update**: `Middleware` lost its `_method` generic. Use `Middleware<{}, Transform>` (not `Middleware<'ANY', {}, Transform>`). See `guides/action-type-patterns.md`

## Key Points

1. **Global middleware** in `createRouter({ middleware: [...] })` — runs all requests
2. **Route middleware** in `router.map(route, { middleware: [...] })` — runs specific routes
3. **Order matters**: `[a, b, c]` runs a → b → c → handler
4. **Short-circuit**: Return response to stop the chain early
5. **Context population**: Earlier middleware sets values for later middleware/handlers

## Pattern: Global Middleware Chain

```typescript
import { createRouter } from 'remix/fetch-router'
import { asyncContext } from 'remix/async-context-middleware'
import { staticFiles } from 'remix/static-middleware'
import { loadDatabase } from './middleware/database.ts'
import { requireAuth } from './middleware/auth.ts'

let router = createRouter({
  middleware: [
    staticFiles('./public'), // 1. Serve static files
    asyncContext(), // 2. Enable getContext()
    loadDatabase(), // 3. Add db to context
    requireAuth(), // 4. Authenticate + populate context.user
  ],
})
```

## Pattern: Route-Level Middleware

```typescript
router.map(routes.admin.dashboard, {
  middleware: [requireAdmin()], // Only admin routes
  handler: adminDashboard,
})
```

## Pattern: Action-Level Middleware (Updated)

Actions can declare their own middleware with typed context via `Action<typeof routes.X, AppContext, typeof middleware>`:

```typescript
import type { Action } from 'remix/fetch-router'
import type { AppContext } from '../router.ts'

const accountMiddleware = [requireAuth()] as const

let accountAction = {
  middleware: accountMiddleware,
  handler(context) {
    // context is typed with auth-injected values
    let auth = context.get(Auth)
    return Response.json({ id: auth.identity.id })
  },
} satisfies Action<typeof routes.account, AppContext, typeof accountMiddleware>
```

> **Note**: `BuildAction` is renamed to `Action`. The method generic (`'GET'`) and the `_method` generic on `Middleware` are both removed. See `guides/action-type-patterns.md` for the full migration guide.


## Pattern: Short-Circuit for Auth

```typescript
let requireAuth: Middleware = async (ctx, next) => {
  if (!ctx.user) {
    return redirect('/login') // Short-circuit: stops chain
  }
  return next() // Continue to next middleware/handler
}
```

## Order Principles

| Position | Middleware          | Purpose               |
| -------- | ------------------- | --------------------- |
| 1st      | `staticFiles`       | Fast path for assets  |
| 2nd      | `asyncContext()`    | Enable `getContext()` |
| 3rd      | `loadDatabase()`    | Add `db` to context   |
| 4th+     | Auth, logging, etc. | Use populated context |

**Rule**: Infrastructure first, then business logic.

## Anti-Patterns

❌ **Don't** put slow operations early:

```typescript
// BAD: Database in first middleware blocks static files
middleware: [loadDatabase(), staticFiles('./public')]
```

✅ **Do** put static file handler first:

```typescript
// GOOD: Static files served without DB overhead
middleware: [staticFiles('./public'), loadDatabase()]
```

❌ **Don't** use middleware for one route in global chain:

```typescript
// BAD: Admin check runs on ALL requests
middleware: [requireAuth(), requireAdmin()]
```

✅ **Use route middleware** for route-specific checks.

## 📂 Codebase References

**Real Implementation**: `demos/frame-navigation/config/router.tsx` — Full middleware chain  
**Pattern Source**: `packages/fetch-router/README.md` — Middleware documentation

## Related Files

- `guides/typed-context.md` — Type-safe context
- `guides/split-controllers.md` — Controller organization
- `guides/rate-limiting.md` — Rate limit middleware
