<!-- Context: development/remix3/packages/concepts | Priority: critical | Version: 1.0 | Updated: 2026-05-20 -->

# Breaking Changes — v3.0.0-beta.1

Key breaking changes from the `remix` package CHANGELOG. Apps migrating from earlier betas should address these.

## Import Path Migration

Old flat paths → new domain-oriented paths:

| Old Import | New Import |
|------------|------------|
| `remix/auth-middleware` | `remix/middleware/auth` |
| `remix/form-data-middleware` | `remix/middleware/form-data` |
| `remix/logger-middleware` | `remix/middleware/logger` |
| `remix/session-middleware` | `remix/middleware/session` |
| `remix/render-middleware` | `remix/middleware/render` |
| `remix/fetch-router` | `remix/router` |
| `remix/fetch-router/routes` | `remix/routes` |
| `remix/data-table-mysql` | `remix/data-table/mysql` |
| `remix/file-storage-s3` | `remix/file-storage/s3` |
| `remix/session-storage-memcache` | `remix/session-storage/memcache` |

Existing 1:1 exports remain during beta but will be removed before stable.

## Removed Types

- `ContextWithAuth` / `ContextWithRequiredAuth` — Use `MiddlewareContext<typeof [requireAuth], AppContext>`
- `ContextWithRenderer` — Use `MiddlewareContext<typeof [renderWith]>`
- Async context types: `AsyncContextTypes` removed; use `RouterTypes.context` augmentation
- `compareFn` on `match`/`matchAll` — matches always sort by specificity
- Low-level helpers: `BuildAction`, `MiddlewareContextTransform`, `ContextTransform`, `ApplyContextTransform`, `ApplyMiddleware`, `ApplyMiddlewareTuple` — Use `ContextWithParams`, `ContextWithEntry`, `MiddlewareContext`, `RouteEntry`

## App Structure

- `app/controllers/` → `app/actions/` with `createController()` and controller files
- Root route actions go into `app/actions/controller.tsx`
- Nested route maps use explicit `router.map(...)` per route map
- Controller middleware applies only to direct actions owned by that controller

## Route Pattern Modularization

`remix/route-pattern` split into subpath exports to avoid client-side JS bloat:

- `remix/route-pattern/href` — type-safe href generation
- `remix/route-pattern/match` — pattern matching with ranking
- `remix/route-pattern/join` — pattern combination
- `remix/route-pattern/specificity` — match ranking

## Testing Changes

- `remix test` and `remix/test` use internal `node-tsx` loader instead of `tsx` package
- `MiddlewareContext` now accepts middleware values plus optional base context
- `createAction()` / `createController()` are preferred helpers for stored handlers

## Reference

Full CHANGELOG: `~/remix/packages/remix/CHANGELOG.md`
