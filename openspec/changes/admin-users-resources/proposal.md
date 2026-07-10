## Why

The application already has `users` and `resources` tables defined in the schema, but there is no admin interface to manage them directly. Currently, admin users cannot view, search, create, edit, or delete users/resources through the admin panel. Adding these two CRUD admin routes provides full data management capabilities and completes the admin coverage for core entity tables.

## What Changes

- Add a new **Admin Users** route under `/admin/users` with full CRUD (list with pagination/sort/filter, create inline form, edit inline form, delete)
- Add a new **Admin Resources** route under `/admin/resources` with full CRUD (list with pagination/sort/filter, create inline form, edit inline form, delete)
- Register both routes in the route definitions, controller, router, admin nav, and route labels
- Follow existing admin patterns (modeled after admin-nutzer, admin-offerings, admin-appointments)

## Capabilities

### New Capabilities

- `admin-users`: Admin CRUD for the `users` table — list with pagination, sorting, search filter, inline create/edit/delete. Routes: GET `/admin/users` (index), POST `/admin/users` (create), PUT `/admin/users/:id` (update), DELETE `/admin/users/:id` (destroy).
- `admin-resources`: Admin CRUD for the `resources` table — list with pagination, sorting, search filter, inline create/edit/delete. Routes: GET `/admin/resources` (index), POST `/admin/resources` (create), PUT `/admin/resources/:id` (update), DELETE `/admin/resources/:id` (destroy).

### Modified Capabilities

_(No existing specs are modified — these are entirely new capabilities.)_

## Impact

- **New files**:
  - `app/actions/admin-users-controller.tsx` — controller for `/admin/users`
  - `app/actions/admin-resources-controller.tsx` — controller for `/admin/resources`
  - `app/ui/admin-users-page.tsx` — list + edit/create panels for users
  - `app/ui/admin-resources-page.tsx` — list + edit/create panels for resources
- **Modified files**:
  - `app/routes.ts` — add `users` and `resources` route definitions under `adminRoutes`
  - `app/router.ts` — map new routes to their controllers
  - `app/ui/admin-layout.tsx` — add nav items for Users and Resources
  - `app/ui/route-labels.ts` — add display labels for new routes
