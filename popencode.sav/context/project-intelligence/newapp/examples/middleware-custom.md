<!-- Context: project-intelligence/newapp/examples/middleware-custom | Priority: high | Version: 1.0 | Updated: 2026-05-13 -->

# Example: Custom Middleware

**Purpose**: Template for creating custom route-level middleware that uses `context.get(Key)` for anonymous context types.

---

## Rate Limiter Middleware

```tsx
import type { Middleware } from 'remix/fetch-router'
import { Auth } from 'remix/auth-middleware'
import type { AuthState } from 'remix/auth-middleware'
import type { User } from '../data/schema.ts'

interface RateLimitOptions {
  maxRequests?: number
  windowMs?: number
}

export function rateLimit(options?: RateLimitOptions): Middleware {
  let maxRequests = options?.maxRequests ?? 10
  let windowMs = options?.windowMs ?? 60_000

  return async (context, next) => {
    let auth = context.get(Auth) as AuthState<User> | undefined
    if (auth?.ok) {
      let key = `ratelimit:${auth.identity.id}`
      // check rate limit using key
    }
    return next()
  }
}
```

## Key Rules

1. **Return `Middleware` type** — The function returns `Middleware`, not `Middleware<...>`
2. **Use `context.get(Key)`** — Middleware context parameter is not typed as `AppContext`, use `.get()` instead of direct properties
3. **Call `next()`** — Always call and return `return next()` unless blocking the request
4. **Throw early if dependencies missing** — Check required middleware ran

## Usage in Controller

```tsx
export default createController<typeof routes, AppContext>(routes, {
  middleware: [rateLimit({ maxRequests: 5 })],
  actions: { /* ... */ },
})
```

## 📂 Codebase References

- **Real middleware**: `app/middleware/admin.ts` — `requireAdmin()` follows this pattern
- **Real middleware**: `app/middleware/auth.ts` — `requireAuth()` with returnTo capture
- **Real usage**: `app/actions/admin-controller.tsx` — `[requireAuth(), requireAdmin()]`

## Related

- [Middleware Chain](../concepts/middleware-chain.md) — Where custom middleware runs
- [Controller Pattern](../guides/controller-pattern.md) — Adding middleware to controllers
- [Auth Architecture](../concepts/auth-architecture.md) — requireAuth/requireAdmin patterns
