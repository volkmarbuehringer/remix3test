<!-- Context: development/remix3/guides/router-mapping | Priority: high | Version: 1.0 | Updated: 2026-05-02 -->

# Router Mapping

## When to Use What

| Router method | Target type | Handler type |
|---|---|---|
| `router.map(routes.X, controller)` | RouteMap | Controller with `actions` |
| `router.map('/pattern', handler)` | string/RoutePattern | Action handler |
| `router.get(routes.X, handler)` | Route leaf | Action handler |
| `router.post(routes.X, handler)` | Route leaf | Action handler |
| `router.put(routes.X, handler)` | Route leaf | Action handler |
| `router.delete(routes.X, handler)` | Route leaf | Action handler |

## Key Rule

Controllers **cannot nest** other controllers. Each RouteMap must have its own `router.map()` call with its own controller. Routes within the same parent do not share a controller — each gets mapped independently.

This means:

| Route creator | Produces | Needs `router.map()` + Controller? |
|---|---|---|
| `route('path', { ... })` with nested defs | RouteMap | Yes |
| `form('path')` — index + action | RouteMap (Route) | Yes |
| `resources('path')` — CRUD routes | RouteMap (Route) | Yes |
| `{ ... }` plain object with nested keys | RouteMap | Yes |
| `get('/path')` | Route leaf | No — use `router.get()` |
| `post('/path')` | Route leaf | No — use `router.post()` |
| `'/path'` string shorthand | Route leaf | No — use `router.map()` with action |

## Example: my_app router.ts

```typescript
// app/router.ts
import { routes } from './routes.ts'

// RouteMaps — each gets its own controller + router.map()
router.map(routes.messages, messagesController)     // route() with nested defs
router.map(routes.chat, chatController)              // route() with nested defs
router.map(routes.admin, adminController)             // route() with nested defs
router.map(routes.admin.lists, adminListsController)  // route() deeply nested

// Route leaves — use verb methods
router.get(routes.messagesContent, messagesContent)   // get() → Route leaf
router.get(routes.messagesSubscribe, messagesSubscribe) // get() → Route leaf
router.post(routes.authLogout, logout)                 // post() → Route leaf

// String shorthand is also a Route leaf → router.map() with action
router.get(routes.assets, assetsHandler)
```

## Example: bookstore router.ts

```typescript
// app/router.ts
// RouteMaps (need controllers)
router.map(routes.home, home)                     // plain string '/' wrapped in route()
router.map(routes.books, booksController)          // route() with 3 leaves
router.map(routes.auth, authController)            // RouteMap: only logout leaf
router.map(routes.auth.login, authLoginController) // form() → RouteMap
router.map(routes.auth.register, authRegisterController)
router.map(routes.cart, cartController)            // route() with nested defs
router.map(routes.cart.api, cartApiController)     // plain object RouteMap
router.map(routes.admin.books, adminBooksController)// resources() → RouteMap
router.map(routes.admin.users, adminUsersController)

// Route leaves (use verb methods)
router.get(routes.books1, books1)     // get() → single Route leaf

// Custom keyed router.map() for a single-leaf controller
router.map({ messagesSubscribe: routes.messagesSubscribe }, messagesSubscribeController)
```

## Runtime Validation

When `router.map()` receives a RouteMap + Controller, it validates:

1. **No extra actions**: Controller action keys must be Route leaves (not RouteMaps)
2. **No missing actions**: All Route leaves in the RouteMap must have action handlers
3. RouteMap sub-keys (nested maps) are ignored by the controller — they get their own `router.map()` call

## Common Mistake

```typescript
// ❌ WRONG: putting a RouteMap in controller actions
export default {
  actions: {
    // ... OK: these are Route leaves
    // ...
    // ❌ BAD: 'lists' is a RouteMap (route('lists', { ... }))
    lists: someListsController,
  },
} satisfies Controller<typeof routes.admin>

// ✓ CORRECT: move lists to its own router.map() call
router.map(routes.admin, adminController)
router.map(routes.admin.lists, adminListsController) // separate call
```

## References

- `my_app/app/router.ts` — Full router setup
- `bookstore/app/app-router.ts` — Bookstore router with createBookstoreRouter()
- `packages/fetch-router/src/lib/router.ts` — `mapController()` at line 414
