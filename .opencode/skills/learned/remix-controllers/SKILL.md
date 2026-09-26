---
name: remix-controllers
description: 'Use when typing or consolidating Remix 3 controllers/middleware — `createController` vs `createAction`, the route contract (`resources`/`exclude`, `patch`/`head`/`options`, nested-map registration, `context.method`), context keys, `Pick` slices for handler context, the request pipeline (`createRequestListener`, middleware ordering, `RouterContext` vs `MiddlewareContext`, `request.signal`), consolidation, error-centralization tests.'
user-invocable: false
origin: consolidated
---

# Remix 3 Controllers & Middleware Patterns

**Consolidated from:** `remix-createContextKey-property-middleware`, `remix-createController-generic-helper-edge-case`, `remix-createController-requires-route-map`, `remix-consolidate-controllers`, `remix-middleware-error-centralization`

This skill is the **index** for controller/middleware deltas. For the framework API and canonical patterns, use the vendor references `node_modules/remix/guides/02-routing-and-controllers.md` and `node_modules/remix/src/fetch-router/README.md`.

## Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| `createController` vs `createAction`, `form()` routes, TS errors about `RouteMap`/`ActionRoute`, explicit generics, `Pick<AppContext, ...>` helper params | `references/controller-routing-and-types.md` |
| A typed `context.<property>` from middleware, `Symbol` key errors, circular `AppContext` dependency flow | `references/context-keys-and-dependency-flow.md` |
| Merging flat controller directories into a parent `controller.tsx` (names, imports, router, tests, `remix doctor`) | `references/controller-consolidation.md` |
| Existing tests breaking after moving error handling into middleware | `references/error-centralization-tests.md` |
| Route contract: `resources()`/`resource()` options (`only` vs this app's `exclude`), `patch`/`head`/`options` or any-method/bare-string leaves, nested-map registration and startup throws, `context.has`/`context.router`/request-only `context.headers` | `references/route-contract-and-controllers.md` |
| Request pipeline: `createRequestListener` options and the `(request, client)` arg, root middleware order (`compression`/`staticFiles`/`logger`), `RouterContext` vs `MiddlewareContext`, `request.body`/`request.signal` streaming and cancellation | `references/request-middleware.md` |

## Core Rules

- Single-method routes (`get`/`post`/`put`/`del`) use `createAction` + `router.get/post/...`; `form()` routes use `createController` with `actions.index`/`actions.action` + `router.map()`.
- Context keys must be `object`s — use `createContextKey`, never `Symbol`.
- Keep the `createController<typeof routes.x, AppContext>` generic when a typed helper needs a specific middleware-provided type; prefer fixing the wrapper (`requireAuthenticatedUser<User>`) at the source when possible.
- Type controller-helper params as `Pick<AppContext, ...>` of the members used, not the whole `AppContext` (whole-object assignment fails via `get()` method variance).
- Keep `app/middleware/root.ts` free of `router.ts`/controller imports so `AppContext` derives without a cycle.

**Route Contract and Resource Helpers (`references/route-contract-and-controllers.md`)**

- `resources()`/`resource()` accept `exclude` as well as `only` (mutually exclusive); this app uses `exclude` (`app/routes.ts:76,238,240`) — do not rewrite to `only`.
- A controller owns only the direct `Route` leaves of its map; register nested maps (e.g. `routes.appointment.types`) separately. A missing, unknown, or nested key throws a `TypeError` at `router.map(...)` (startup), not on the first request.
- `controller.middleware` reaches only that controller's direct leaves, not a separately-mapped nested map; repeat the boundary there.
- Bare-string leaves are `Route<'ANY', ...>` — branch on `context.method`. `context.headers` is request headers, so return a `Response` for response headers; `context.router` re-enters the pipeline.

**Request Pipeline and Middleware Ordering (`references/request-middleware.md`)**

- The app owns the 500 response in `createServerHandler` (`app/utils/server-handler.ts`), not `createRequestListener`'s `onError`; the client address arrives via the listener's `(request, client)` argument and is stamped as `X-Client-Ip`.
- Root order lives in `app/middleware/root.ts`; `compression()` runs after `staticFiles()` (so root static responses are uncompressed) and `loadDatabase()` must precede `loadAuth()`.
- `logger()` / `context.logger?.(...)` is the app logging channel. Derive `AppContext` with `MiddlewareContext<ReturnType<typeof createNewappMiddleware>>` and keep the `declare module 'remix'` augmentation; do not switch to `RouterContext<typeof router>` without inlining the chain.
- `request.body` is a Web stream (`app/middleware/json-body.ts` caps and cancels it); use `context.request.signal` for disconnect cleanup.

## When to Use

- You are adding or reshaping the route contract (resource helper options, a method-specific leaf, or a nested route map) and need the app-specific seams the guide cannot know.
- You are wiring or debugging controllers: nested-map registration, startup `Missing action`/`Unknown action` throws, or controller middleware that does not reach a nested branch.
- You are editing the server boundary or the root middleware chain: `createRequestListener` options, client address, middleware order, logging, or `AppContext` derivation.
- You are reading built-in action context (`context.has`, `context.router`, `context.headers`) or handling `request.body`/`request.signal`.

## Related Skills

- `remix3-route-wiring` (`references/route-relocation.md`) — moving routes between route trees (frame ↔ top-level)
- `node_modules/remix/src/render-middleware/README.md` — wiring request-scoped renderers into the router
