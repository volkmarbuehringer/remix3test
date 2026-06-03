## Why

newapp currently uses the oldest middleware context pattern — a manual `RootMiddleware` tuple in `app/types/context.ts` listing every middleware's `ReturnType`, then `MiddlewareContext<RootMiddleware>` to derive `AppContext`. This AppContext is then imported by 30+ controller files as an explicit generic on every `createController<T, AppContext>(...)` call.

Recent Remix 3 updates (Jun 1–2, 2026) introduced two changes that make this obsolete:

1. **`createMiddleware()`** — composes middleware chains while preserving exact tuple types, eliminating the need to manually list `ReturnType`s.
2. **`RouterContext<typeof router>`** — derives the app context type directly from the router, so the router becomes the single source of truth for request context types.

All Remix demos have migrated away from the manual tuple pattern:
- `unpkg` and `timeboxer` use `RouterContext<typeof router>` — the fullest modernization
- `frame-navigation`, `frames`, and `sse` use `createMiddleware()` + `MiddlewareContext<typeof ...>`
- `social-auth` wraps `createMiddleware()` in a factory function (same structure as `createNewappRouter`)

`timeboxer` goes furthest: controllers no longer import `AppContext` at all. They use `createController(routes.x, { ... })` without generic type parameters, relying on inference.

## What Changes

- **Replace the `RootMiddleware` tuple in `app/types/context.ts`** — switched to `createMiddleware()` factory that composes all 12 middleware functions, plus derived `AppContext` type
- **Simplify `app/router.ts`** — middleware imports removed, factory call replaces inline array, type inferred from middleware chain
- **Single source of truth** — `context.ts` is the only place where middleware order determines the context type; adding/removing middleware only requires one file change
- **Controllers unchanged** — `createController<T, AppContext>` calls remain; the type now derives from `createMiddleware()` instead of the manual tuple

## Capabilities

### New Capabilities

None — this is a pure refactoring. No behavior changes, no new features.

### Modified Capabilities

None — no existing capability specs are modified. The middleware context derivation is an internal implementation detail.

## Impact

- **Files modified**: `app/router.ts` (simplified imports, middleware factory call), `app/types/context.ts` (replaced RootMiddleware tuple with `createMiddleware()` factory)
- **Files cleaned up**: none (controllers retain AppContext generics — see design for rationale)
- **Dependencies**: none changed
- **Breaking changes**: none — `AppContext` type is binary-compatible with previous definition
