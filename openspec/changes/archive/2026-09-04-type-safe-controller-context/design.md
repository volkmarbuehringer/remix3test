## Context

The router augments `RouterTypes.context = AppContext` (`app/router.ts:42`), so every `createController` handler receives a fully-typed `AppContext`. Helper functions that receive `context` from those handlers are typed `any` in 18 places, erasing that typing. `AppContext = MiddlewareContext<ReturnType<typeof createNewappMiddleware>>` and indexed access (`AppContext['db']`) is already proven in `app/actions/auth/controller.tsx:481`. See proposal.md for the inventory and motivation.

## Goals / Non-Goals

**Goals:**
- Kill all `context: any` / `db: any` in controller helpers.
- Type render-only and url-only helpers with the narrowest slice that satisfies their actual usage, so callers can pass a minimal object in tests.
- Drop the `as unknown as` cast in `getAdminIdentity`.
- Write the narrow-slice rule down as a spec so it survives.

**Non-Goals:**
- Enabling `no-explicit-any` lint enforcement (thread D — separate change).
- The `z.any()` tool-schema cleanup in Mastra tools (thread B — separate change).
- `noUncheckedIndexedAccess` / `exactOptionalPropertyTypes` compiler flags (thread E — separate change).

## Decisions

### D1: Multi-member helpers take `Pick<AppContext, ...>` slices; single-member helpers take inline slices

A helper that touches `db` + `url` + `session` is typed `context: Pick<AppContext, 'db' | 'url' | 'session'>`. A helper that touches only `context.render` is typed `{ render: AppContext['render'] }`; only `context.url` → `{ url: AppContext['url'] }`; only `db` → `db: AppContext['db']`.

- **Why `Pick`, not the whole `AppContext`**: the whole `AppContext` type is **not assignable** from a controller handler context when the controller declares its own middleware. `createController` with `middleware: [requireAuth(), ...]` produces a handler context whose `get()` overloads differ from `AppContext`'s (the `auth` entry is `GoodAuth<User>` from `requireAuth` vs `AuthState<User>` from root `loadAuth`), and TypeScript rejects the whole-object assignment via method variance even though every property matches. `Pick`/indexed-access slices bypass `get()` and are property-based, so they assign cleanly. Verified: the initial `context: AppContext` pass produced 60 errors; the `Pick` pass compiles with zero.
- **Why narrow slices**: the helper's signature documents exactly what it consumes; unit tests can pass a minimal object without constructing a full context; helpers decouple from root-middleware shape changes.
- **Why not always `AppContext`**: whole-context params make every helper depend on the full middleware chain and force tests to build a full context. It only works for route handlers registered without controller middleware (e.g. `auth`'s `registerSent`/`verify`), so it is not a safe convention.
- **Alternative rejected**: defining a bespoke `RenderContext`/`UrlContext` type alias — unnecessary indirection; inline `Pick`/indexed-access is self-documenting.

### D2: Narrowed object params keep call sites unchanged

`renderOfferingsPage(context, data)` stays `renderOfferingsPage(context, data)` — the param type narrows to `{ render: AppContext['render'] }`, but `context` (an `AppContext`) remains assignable. No call-site churn.

- **Alternative rejected**: changing helpers to take `render` as a positional arg (`renderOfferingsPage(context.render, data)`) — cleaner in isolation but edits every call site and diverges from the `db: AppContext['db']` precedent, which uses the object/destructured form.

### D3: `getAdminIdentity` takes `AuthState<User> | undefined`

The auth middleware is `createSessionAuthScheme<User, ...>`, so `context.auth` is already `AuthState<User>`. Widening the param from `AuthState<any>` removes the `as unknown as { id: number; email: string }` cast — `User` is assignable to the `{ id: number; email: string }` return shape.

## Risks / Trade-offs

- [A helper secretly reads a member not in its narrowed slice] → TypeScript flags it immediately (`npm run typecheck`); the classification in proposal.md was verified against each helper's actual `context.*` usage.
- [Narrowing changes a public signature that a test relies on] → `npm test` covers the affected controllers; narrowed params are strictly more permissive for callers.

## Migration Plan

Single mechanical pass per file, then `npm run typecheck` and `npm test`. No rollback risk — type-only change; revert is trivial if a signature is contested.

## Open Questions

None.