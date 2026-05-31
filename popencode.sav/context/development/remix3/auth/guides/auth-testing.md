# Auth Middleware Patterns

<!-- Context: development/remix3/guides | Priority: high | Version: 1.1 | Updated: 2026-03-30 -->

Patterns for authentication middleware in Remix 3 projects, enabling unit testing with auth-protected routes.

## The Problem
Global auth middleware blocks unit testing:
```typescript
middleware.push(requireAuth) // ❌ Blocks testing - all routes redirect without auth
```
When a route returns a redirect, you can't test the actual route logic in unit tests.

## The Solution
**Split auth into two concerns:**
1. **`loadAuth()`** - Load user into context (no redirect)
2. **`requireAuth()`** - Check auth and redirect if needed

```typescript
import { loadAuth, requireAuth } from './auth/middleware.ts'
middleware.push(loadAuth()) // Global: load user only
router.map(mainRoutes, { middleware: [requireAuth()], actions: { ... } }) // Route: check auth
```

## Middleware Implementation
```typescript
const PUBLIC_ROUTES = ['/', '/login', '/logout', '/health', '/api/', '/users/']

export function loadAuth(): Middleware {
  return async (ctx, next) => {
    ctx.userId = null; ctx.user = undefined
    let cookie = await authCookie.parse(ctx.request.headers.get('cookie'))
    if (cookie) { let userId = parseInt(cookie, 10); if (!isNaN(userId) && userId > 0) { ctx.userId = userId; ctx.user = await getUser(userId) } }
    return next() // Never blocks!
  }
}

export function requireAuth(): Middleware {
  return async (ctx, next) => {
    if (isPublicRoute(ctx.url.pathname)) return next()
    if (process.env.SKIP_AUTH === 'true' || process.env.NODE_ENV === 'test') return next()
    if (!ctx.userId) return redirect('/login')
    return next()
  }
}
```

## Testing Pattern
### Enable Testing via Environment
The middleware auto-detects test mode: `process.env.SKIP_AUTH === 'true' || process.env.NODE_ENV === 'test'`

### Package.json Configuration
```json
{ "scripts": { "test": "SKIP_AUTH=true NODE_ENV=test tsx --test './app/**/*.test.ts'", "test:e2e": "playwright test" } }
```

### Unit Tests vs E2E Tests
| Test Type | Auth Needed | Command |
|-----------|-------------|---------|
| Unit | Skipped (SKIP_AUTH) | `pnpm test` |
| E2E | Real auth | `pnpm test:e2e` |

### Skip Auth-Dependent Tests
```typescript
const skipAuthTests = process.env.SKIP_AUTH === 'true' || process.env.NODE_ENV === 'test'
describe('Authorization Middleware', { skip: skipAuthTests }, () => { it('redirects unauthenticated users', async () => { /* Skipped in unit test mode */ }) })
```

### Module-Scope Constants
Use `const` for module-scope constants (lint rule): `const skipAuthTests = process.env.SKIP_AUTH === 'true'`

## Route-Level Middleware
Apply middleware per controller:
```typescript
router.map(routes.admin, { middleware: [requireAdmin()], ...adminController.actions })
router.map(routes.health, { actions: { health(context) { ... } } })
```

## Key Insight
> **Unit tests should test route logic, not auth logic.**
> - Auth redirects → security tests (skip in unit tests)
> - Route logic → unit tests (with SKIP_AUTH)
> - UI flows → E2E tests (real auth)

## Related
- `guides/lint-rules.md` - **"Always Do" checklist**
- `guides/e2e-testing.md` - E2E testing patterns
- `guides/test-coverage.md` - Unit vs E2E testing
- `guides/auth-middleware.md` - Basic auth patterns
