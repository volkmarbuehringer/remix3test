<!-- Context: project-intelligence/newapp/concepts/middleware-chain | Priority: critical | Version: 1.1 | Updated: 2026-05-14 -->

# Concept: Middleware Chain Architecture

**Core Idea**: Every request passes through a fixed 10-middleware stack in `app/router.ts` that installs request-scoped services on the context. The order is strict — each middleware depends on the previous one.

---

## Middleware Stack

```
logger()            → context.logger       (request tracing)
  ↓
compression()       → response compression (gzip/brotli)
  ↓
formData()          → context.formData      (parsed form body)
  ↓
methodOverride()    → rewrites method       (PUT/DELETE from _method field)
  ↓
session()           → context.session       (cookie-backed session store)
  ↓
asyncContext()      → enables getContext()  (async local storage)
  ↓
loadDatabase()      → context.db            (database instance, property: 'db')
  ↓
loadAuth()          → context.auth          (auth state with identity)
  ↓
loadAssetEntry()    → scripts for render    (resolved script src/preloads)
  ↓
render()            → context.render        (SSR render function)
```

## What Each Middleware Provides

| Middleware | Context Key | Type | Source |
|-----------|-------------|------|--------|
| `logger` | `context.logger` | `Logger` | `remix/logger-middleware` |
| `compression` | (response transform) | — | `remix/compression-middleware` |
| `formData` | `context.formData` | `FormData` | `remix/form-data-middleware` |
| `methodOverride` | (rewrites method) | — | `remix/method-override-middleware` |
| `session` | `context.session` | `Session` | `remix/session-middleware` |
| `asyncContext` | `getContext()` | — | `remix/async-context-middleware` |
| `loadDatabase` | `context.db` | `Database` | `app/middleware/database.ts` |
| `loadAuth` | `context.auth` | `AuthState<User>` | `app/middleware/auth.ts` |
| `loadAssetEntry` | `getAssetEntry()` | `AssetEntry` | `app/middleware/asset-entry.ts` |
| `render` | `context.render` | `Renderer` | `app/middleware/render.tsx` |

## Key Rules

1. **Order is fixed** — Do not reorder. `session` must come before `loadAuth`, `formData` before password auth callbacks.
2. **Custom middleware** — Add route-specific middleware via the controller's `middleware: []` array (e.g., `requireAuth()`), not the global stack.
3. **Extending the stack** — Add to both `router.ts` and `app/types/context.ts` for type safety.

## Context Type Wiring

`app/types/context.ts` declares `AppContext` by extracting types from each middleware:

```ts
type RootMiddleware = [
  ReturnType<typeof formData>,
  ReturnType<typeof session>,
  ReturnType<typeof loadDatabase>,
  ReturnType<typeof loadAuth>,
  ReturnType<typeof render>,
]
export type AppContext = MiddlewareContext<RootMiddleware>
```

Middleware that doesn't augment the context type (`logger`, `asyncContext`) is excluded from the list.

## Adding Custom Middleware

See [middleware-custom example](../examples/middleware-custom.md) for a working template.

## 📂 Codebase References

- **Stack definition**: `app/router.ts` — 10-item `middleware: [...]` array
- **Context type**: `app/types/context.ts` — `AppContext` type definition
- **Database middleware**: `app/middleware/database.ts` — `loadDatabase()` installs `context.db`
- **Auth middleware**: `app/middleware/auth.ts` — `loadAuth()` installs `context.auth`
- **Render middleware**: `app/middleware/render.tsx` — `render()` installs `context.render`
- **Session config**: `app/middleware/session.ts` — `sessionCookie` + `sessionStorage`

## Related

- [Form Ergonomics](./form-ergonomics.md) — methodOverride + data-schema patterns
- [Context Access Patterns](./context-access-patterns.md) — How to use context properties
- [Controller Pattern](../guides/controller-pattern.md) — Middleware per controller
- [Auth Architecture](./auth-architecture.md) — Auth middleware design
- [Architecture Overview](./architecture.md) — App-level file ownership
