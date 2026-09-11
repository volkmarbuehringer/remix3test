---
name: remix-controllers
description: 'Use when typing or consolidating Remix 3 controllers/middleware — `createController` vs `createAction`, context keys, `Pick` slices for handler context, consolidation, error-centralization tests.'
user-invocable: false
origin: consolidated
---

# Remix 3 Controllers & Middleware Patterns

**Consolidated from:** `remix-createContextKey-property-middleware`, `remix-createController-generic-helper-edge-case`, `remix-createController-requires-route-map`, `remix-consolidate-controllers`, `remix-middleware-error-centralization`

This skill is the **index** for controller/middleware deltas. For the framework API and canonical patterns, use the vendor references `remix/references/routing-and-controllers.md` and `remix/references/middleware-and-server.md`.

## Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| `createController` vs `createAction`, `form()` routes, TS errors about `RouteMap`/`ActionRoute`, explicit generics, `Pick<AppContext, ...>` helper params | `references/controller-routing-and-types.md` |
| A typed `context.<property>` from middleware, `Symbol` key errors, circular `AppContext` dependency flow | `references/context-keys-and-dependency-flow.md` |
| Merging flat controller directories into a parent `controller.tsx` (names, imports, router, tests, `remix doctor`) | `references/controller-consolidation.md` |
| Existing tests breaking after moving error handling into middleware | `references/error-centralization-tests.md` |

## Core Rules

- Single-method routes (`get`/`post`/`put`/`del`) use `createAction` + `router.get/post/...`; `form()` routes use `createController` with `actions.index`/`actions.action` + `router.map()`.
- Context keys must be `object`s — use `createContextKey`, never `Symbol`.
- Keep the `createController<typeof routes.x, AppContext>` generic when a typed helper needs a specific middleware-provided type; prefer fixing the wrapper (`requireAuthenticatedUser<User>`) at the source when possible.
- Type controller-helper params as `Pick<AppContext, ...>` of the members used, not the whole `AppContext` (whole-object assignment fails via `get()` method variance).
- Keep `app/middleware/root.ts` free of `router.ts`/controller imports so `AppContext` derives without a cycle.

## Related Skills

- `remix-route-relocation` — moving routes between route trees (frame ↔ top-level)
- `~/remix/packages/render-middleware/README.md` — wiring request-scoped renderers into the router
