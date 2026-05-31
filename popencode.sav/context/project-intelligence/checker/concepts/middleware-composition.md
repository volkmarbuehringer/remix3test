<!-- Context: project-intelligence/checker/concepts/middleware-composition | Priority: high | Version: 1.0 | Updated: 2026-04-17 -->

# Middleware Composition

**Core Idea**: Chain middleware functions that progressively enrich request context. Each layer adds capabilities without duplicating concerns.

## Middleware Stack

```
Request → formData() → session() → loadDatabase() → loadAuth() → Handler
```

| Middleware | Adds to Context | Purpose |
|------------|-----------------|---------|
| `formData()` | `FormData` | Parse POST body |
| `session()` | `Session` | Cookie management |
| `loadDatabase()` | `Database` | DB access |
| `loadAuth()` | `Auth` | Identity resolution |

## Key Principle: Order Matters

**Database must come before Auth** - Auth needs Database to verify user:

```typescript
// ✅ CORRECT
middleware: [
  formData(),
  session(sessionCookie, sessionStorage),
  loadDatabase(),  // ← Database available
  loadAuth(),      // ← Can use Database
]

// ❌ WRONG - Auth can't verify users
middleware: [
  loadAuth(),      // ← Database not available!
  loadDatabase(),
]
```

## Context Access Pattern

```typescript
// Handler retrieves enriched context
function handler({ get }) {
  let session = get(Session)      // From session()
  let db = get(Database)          // From loadDatabase()
  let auth = get(Auth)            // From loadAuth()
}
```

## Route-Level Middleware

Apply `requireAuth()` only to protected routes:

```typescript
// Public routes - no auth required
router.map(routes.home, homeController)
router.map(routes.auth.login, loginController)

// Protected routes - require auth
router.map(routes.account, {
  middleware: [requireAuth()],    // ← Only here
  actions: accountController,
})
```

## Type Safety

```typescript
// Define middleware chain type
export type RootMiddleware = [
  ReturnType<typeof formData>,
  ReturnType<typeof session>,
  ReturnType<typeof loadDatabase>,
  ReturnType<typeof loadAuth>,
]

// Use in handlers
export type AppContext = WithParams<
  MiddlewareContext<RootMiddleware>,
  params
>
```

## 📂 Codebase References

**Implementation:**
- `checker/app/router.ts` - Middleware chain definition
- `checker/app/middleware/session.ts` - Session middleware
- `checker/app/middleware/database.ts` - Database middleware
- `checker/app/middleware/auth.ts` - Auth middleware

## Related

- `guides/login-implementation.md` - Full implementation guide
- `lookup/import-conventions.md` - Import patterns
