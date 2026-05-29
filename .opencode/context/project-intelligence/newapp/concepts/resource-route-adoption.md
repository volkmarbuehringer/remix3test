<!-- Context: project-intelligence/newapp/concepts/resource-route-adoption | Priority: high | Version: 1.0 | Updated: 2026-05-29 -->

# Resource Route Adoption (`resources()` helper)

**Core Idea**: The `resources()` helper from `remix/routes` replaced 3 manual CRUD route blocks in `app/routes.ts`, reducing boilerplate while preserving identical route behavior. This documents which routes were converted, why `exclude` is used, and how it composes with route nesting.

## What Was Converted

Three pure CRUD route blocks (index/create/update/destroy only, no custom actions):

| Route Key | Parent | Before | After |
|-----------|--------|--------|-------|
| `admin.users` | `route('admin', ...)` | 7-line manual block | `resources('users', { exclude: ['new', 'show', 'edit'] })` |
| `admin.resources` | `route('admin', ...)` | 7-line manual block | `resources('resources', { exclude: ['new', 'show', 'edit'] })` |
| `appointment.types` | `route('appointment', ...)` | 7-line manual block | `resources('types', { exclude: ['new', 'show', 'edit'] })` |

## Why `exclude` Is Required

The `resources()` helper generates 7 routes: index, new, show, create, edit, update, destroy. However, Remix 3's `createController` type system requires a handler in `actions` for every route key. Since `admin/users`, `admin/resources`, and `appointment/types` have no controllers/UI for `new`/`show`/`edit`, `exclude` keeps the route set identical to before (index, create, update, destroy only).

When controllers are built for those routes, simply drop the `exclude` option.

## Route Composition Pattern

`resources()` returns a `RouteMap` object that composes directly inside `route()` nesting:

```ts
route('admin', {
  users: resources('users', { exclude: ['new', 'show', 'edit'] }),
  // → GET    /admin/users/          (index)
  // → POST   /admin/users/          (create)
  // → PUT    /admin/users/:id       (update)
  // → DELETE /admin/users/:id       (destroy)
})
```

Route keys (index, create, update, destroy) are unchanged, so existing controller references like `routes.admin.users.index.href()` continue working with no changes.

## What Stays Manual

Routes with custom actions, non-standard HTTP methods, or SSE endpoints remain manual. See [CRUD Route Audit](../lookup/crud-route-audit.md) for the full breakdown.

## 📂 Codebase References

**Implementation**:
- `newapp/app/routes.ts` - Route definitions with 3 `resources()` calls
- `newapp/app/router.ts` - Controller mappings for converted routes

**Source**:
- `packages/fetch-router/src/lib/route-helpers/resources.ts` - The `resources()` helper
- `packages/fetch-router/src/lib/route-helpers/resource.ts` - The `resource()` singleton helper

**Change artifacts**:
- `openspec/changes/archive/2026-05-29-use-resource-helper-for-crud-routes/` - Full design, tasks, specs

**Related context**:
- `development/remix3/fetch-router/guides/resource-routes.md` - Framework-level `resources()` API
- `development/remix3/routing/lookup/route-types.md` - RouteMap vs Route leaf types
