## Why

The `remix/routes` module exports a `resources()` helper that auto-generates standard CRUD route definitions for collection resources (index, new, show, create, edit, update, destroy) with full type safety. The newapp codebase currently defines all admin CRUD routes manually with individual `get('/')`, `post('/')`, `put('/:id')`, `del('/:id')` calls, even for the pure CRUD resources that have no custom actions. This creates unnecessary boilerplate and misses the `show`, `edit`, and `new` routes that `resources()` provides for free.

Adopting `resources()` for pure CRUD routes reduces code, improves consistency, and makes the route structure more discoverable.

## What Changes

- **Import** `resources` from `remix/routes` in `app/routes.ts`
- **Replace** the manual `resources` admin route block with `resources('resources')`
- **Replace** the manual `users` admin route block with `resources('users')`
- **Replace** the manual `types` appointment route block with `resources('types')`
- **No behavioral changes** — existing routes continue to work exactly as before
- **New routes added for free** — `resources()` also generates `show`, `new`, `edit` routes for each resource (`GET /admin/resources/:id`, `GET /admin/resources/new`, etc.). These are additive and don't break anything.

## Capabilities

### New Capabilities

_(none — pure refactoring, no new capabilities)_

### Modified Capabilities

_(none — behavior is unchanged)_

## Impact

- **`app/routes.ts`** — one import addition, three route blocks become one-liners
- **`app/router.ts`** — no changes needed (route keys/names stay the same)
- **Controllers** (`admin-users`, `admin-resources`, `appointtype`) — typed route maps expand with `show`/`new`/`edit` keys but existing handler references still work. New routes have no handlers and will return 404, which is safe.
- No dependency changes
- No database changes
- No behavioral changes to existing endpoints
