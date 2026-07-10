## Context

newapp derives its app context type (`AppContext`) from a manually maintained tuple in `app/types/context.ts`:

```ts
type RootMiddleware = [
  ReturnType<typeof formData>,
  ReturnType<typeof session>,
  ReturnType<typeof loadDatabase>,
  ReturnType<typeof loadAuth>,
  ReturnType<typeof render>,
  ReturnType<typeof json>,
]
export type AppContext = MiddlewareContext<RootMiddleware>
```

This tuple must be kept in sync with the actual middleware array in `app/router.ts`. Every change to the middleware stack requires updating two files. Additionally, `AppContext` is imported by 30+ controller files and passed as an explicit generic to every `createController<>()` call.

Remix 3's Jun 2026 updates introduced two new APIs that eliminate both the manual tuple and the need to import `AppContext` in controllers:

- **`createMiddleware(...)`** — composes middleware functions into a chain that preserves exact tuple types without `as const`
- **`RouterContext<typeof router>`** — extracts the request context type directly from a router value

All Remix demos have adopted one of these patterns and dropped the old manual tuple. `timeboxer` goes furthest: controllers use `createController(routes.x, { ... })` with zero generic type parameters — context is inferred from the module-level `RouterTypes.context` augmentation.

newapp also uses `createNewappRouter(options?)` — a factory that accepts `sessionCookie` and `sessionStorage` — creating a parallel to `social-auth`'s `createSocialAuthRouter()`. The `social-auth` demo wraps its middleware in a `createSocialAuthMiddleware()` factory, then derives the context type from that factory. This is the natural fit for newapp.

## Goals / Non-Goals

**Goals:**

- Replace the `RootMiddleware` tuple in `app/types/context.ts` with `createMiddleware()` in `app/router.ts`
- Extract middleware into a `createNewappMiddleware()` factory following social-auth's pattern
- Derive `AppContext` from the middleware factory return type (not a manual tuple)
- Remove explicit `AppContext` generic from all 30+ `createController<>()` calls
- Remove unused `import type { AppContext }` from all controller files
- Preserve the `createNewappRouter(options?)` public API signature unchanged

**Non-Goals:**

- Changing middleware behavior — purely type-level refactoring
- Using `router.mount()` for route organization (no demo uses it yet)
- Consolidating or restructuring controller files
- Changing the `declare module 'remix/router'` augmentation pattern

## Decisions

### Decision 1: Use `createMiddleware()` factory pattern (social-auth style), not `RouterContext<typeof router>`

**Rationale**: `RouterContext<typeof router>` requires a concrete router value. newapp exposes `createNewappRouter(options?)` as a factory, not a single router instance. Extracting the middleware into a factory function (`createNewappMiddleware(cookie, storage)`) and deriving `AppContext` from its return type (`MiddlewareContext<ReturnType<typeof createNewappMiddleware>>`) preserves the factory pattern while achieving the same type derivation.

**Alternative considered**: Inline middleware and use `RouterContext<typeof router>` on the default export only. Rejected because the factory accepts parameterized middleware (session cookie, session storage), so a single inline middleware array wouldn't capture both the factory and the default export.

### Decision 2: Drop all explicit generics from `createController()` calls

**Outcome**: Rejected during implementation. `createController()`'s `context` generic defaults to `DefaultContext`, not `RouterTypes.context`. Without the explicit `AppContext` generic, TypeScript cannot resolve middleware-provided context properties accessed directly on the context object (`context.formData`, `context.auth`, `context.db`, `context.render`).

The `timeboxer` demo avoids this because it exclusively uses `context.get(Auth)`, `context.get(Database)`, etc. — the `get()` method is generic and infers the return type from the key, not the context type. newapp's controllers use direct property access, which requires the full `AppContext` type to be explicitly provided.

**Revised approach**: Controllers retain their `createController<typeof routes.X, AppContext>(...)` calls. The `AppContext` type now derives from `createMiddleware()` instead of the manual `RootMiddleware` tuple.

### Decision 3: `createNewappMiddleware()` factory co-located in `app/types/context.ts`

**Rationale**: Placing the middleware factory in `router.ts` and re-exporting `AppContext` from `context.ts` creates a circular type dependency: `router.ts` imports controllers, which import `AppContext` from `context.ts`, which re-exports from `router.ts`. This breaks TypeScript's type resolution — `AppContext` resolves to `DefaultContext` instead.

By co-locating both `createNewappMiddleware()` and the `AppContext` type in `context.ts`, and having `router.ts` import from `context.ts`, the dependency flows one way: `router.ts → context.ts → middleware modules`. No cycle.

**Alternative considered**: A separate `app/middleware-chain.ts` file holding both factory and types. Rejected as unnecessary indirection — `context.ts` is already the canonical location for `AppContext`.

### Decision 4: `context.ts` holds both factory and type — router.ts calls the factory

**Rationale**: `context.ts` exports `createNewappMiddleware(cookie, storage)` for the runtime middleware chain, and `AppContext` for the type. `router.ts` imports both. Controllers continue to import `AppContext` from `context.ts` as before. This keeps `context.ts` as the single source of truth for middleware-derived context types.

## Risks / Trade-offs

| Risk                                                                                                       | Mitigation                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `createMiddleware()` type inference failure if a middleware function's return type isn't properly declared | All existing middleware functions already declare explicit return types via `Middleware<{ ... }>` — the inference will work                      |
| `createController()` without generics might not infer context type in all cases                            | The `RouterTypes.context` augmentation is the canonical mechanism Remix 3 uses for context inference — it works in timeboxer and all other demos |
| Large diff touching 30+ files increases review surface                                                     | The controller changes are purely mechanical (remove generics, drop imports) — review risk is low                                                |
| Some controllers additionally import `AppContext` for non-generic uses (e.g., helper function signatures)  | Verify before dropping each import — if `AppContext` is used in function signatures, keep the import but drop the generic                        |
