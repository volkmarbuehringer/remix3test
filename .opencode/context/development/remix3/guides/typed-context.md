<!-- Context: development/remix3/guides/typed-context | Priority: high | Version: 1.1 | Updated: 2026-05-07 -->

# Typed Context in Remix 3

> Type-safe request context with module augmentation and context keys. Enables `getContext()` to return your app's typed context anywhere in the async call stack.

## Quick Reference

- **Use when**: Adding typed properties to request context (db, user, session)
- **Pattern**: Module augmentation + context keys
- **Packages**: `fetch-router`, `async-context-middleware`

## Key Points

1. **Module augmentation** adds properties to `RequestContext` via `declare module`
2. **Context keys** (`createContextKey`) provide type-safe `context.get/set`
3. **Middleware populates** context in order — earlier middleware sets values for later ones
4. **Controllers access** typed context directly: `context.db`, `context.user`
5. **Augment `AsyncContextTypes`** for typed `getContext()` globally

## Pattern: Basic Context Augmentation

```typescript
// app/types/context.ts
import type { Database } from 'remix/data-table'
import type { User } from '../data/schema.ts'

declare module 'remix/fetch-router' {
  interface RequestContext {
    db: Database
    userId: number | null
    user: User | null
  }
}
```

## Pattern: Typed getContext()

```typescript
// app/types/context.ts
import type { AnyParams } from 'remix/fetch-router'

declare module 'remix/async-context-middleware' {
  interface AsyncContextTypes {
    requestContext: RequestContext<AnyParams>
  }
}

// Now getContext() returns typed context
import { getContext } from 'remix/async-context-middleware'

let user = getContext().user // Type-safe!
```

## Pattern: Context Keys (Advanced)

```typescript
import { createContextKey } from 'remix/fetch-router'

const UserKey = createContextKey<User>()

// In middleware
context.set(UserKey, currentUser)

// In handlers/utilities
let user = context.get(UserKey)
```

## Pattern: Middleware Chain

```typescript
let router = createRouter({
  middleware: [
    asyncContext(), // Makes getContext() work
    loadDatabase(), // Sets context.db
    requireAuth(), // Sets context.userId, context.user
    requireAdmin(), // Checks context.user.role
  ],
})
```

## Anti-Patterns

❌ **Don't** use `as any` to access context:

```typescript
let db = (context as any).db // Bypasses type safety
```

✅ **Do** use proper module augmentation instead.

❌ **Don't** use bare `as T` casts on `get()`:

```typescript
let db = context.get(Database) as Database     // Masks missing-middleware bugs
let session = get(Session) as Session | undefined // Better, but fragile
```

✅ **Do** use `get() == null` with early throw instead:

```typescript
let db = context.get(Database)
if (db == null) throw new Error('Expected database middleware before handler')
// db is now Database (narrowed)
```

❌ **Don't** re-query data already in context:

```typescript
// BAD: Queries DB every action
let user = await db.findOne(users, { where: { id: userId } })

// GOOD: Uses cached context
let user = context.user
```

## 📂 Codebase References

**Implementation**: `demos/frame-navigation/app/types/context.db.ts` — Real-world typed context  
**Pattern Source**: `packages/async-context-middleware/README.md` — Module augmentation docs  
**Router Context**: `packages/fetch-router/README.md` — `createContextKey`, typed helpers

## AppController Alternative

Instead of `declare module` augmentation for every context property, define a local `AppController` type alias that binds the middleware stack into controller context:

```typescript
// router.ts
export type RootMiddleware = [
  ReturnType<typeof formData>, ReturnType<typeof session>,
  ReturnType<typeof loadDatabase>, ReturnType<typeof loadAuth>,
]
export type AppContext<params = {}> = WithParams<MiddlewareContext<RootMiddleware>, params>
export type AppController<routes extends RouteMap> = Controller<routes, AppContext>
```

Controllers use `satisfies AppController<typeof routes.X>` and `context.get(X)` resolves to concrete types because TypeScript knows which middleware has run.

**Trade-off**: AppController only benefits controller action handlers. Utilities using `getContext()` still see `T | undefined`. Use the null-check pattern (above) for those paths.

## Related Files

- `development/remix3/guides/split-controllers.md` — Controller patterns
- `development/remix3/guides/sse-implementation.md` — Middleware in SSE
- `development/remix3/middleware/concepts/request-context-get-pattern.md` — Null-check pattern
- `development/remix3/routing/concepts/controller-architecture.md` — AppController in controllers
