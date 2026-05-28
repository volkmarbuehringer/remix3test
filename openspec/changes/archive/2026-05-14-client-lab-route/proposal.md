## Why

The newapp project needs a Client Lab route (`/client`) that demonstrates the full Remix data pattern: server-rendered frames with pagination, sorting, and filtering, plus full-page form-based CRUD editing. This serves as both a developer demo and a quality-of-life tool for testing client record management. The `my_app` project already has this capability; it needs to be ported to newapp with full compliance to newapp's conventions (flat controllers, theme tokens, `input` mixins, `Layout`, Frame-based navigation).

## What Changes

- Add `clients` database table (`id`, `name`, `email`, `role`, `status`, `registered`) with seed data (200 rows)
- Add `pagination.ts` and `sort-params.ts` utility modules
- Add standalone `/client` route with Frame-based grid (pagination, sort, filter, edit links, delete forms), full-page edit form, and POST-based CRUD actions
- Register the route in newapp's route tree and router
- Add "Client Lab" link to the main navigation

## Capabilities

### New Capabilities
- `client-lab`: Server-rendered Frame-based grid with pagination, column sorting, text filtering, inline delete forms, and edit links. Full-page edit form with theme-compliant inputs and form-based save/redirect. All interactions use Frame navigation, form submissions, or link clicks — no custom client JS.

### Modified Capabilities
- (none — existing capabilities unchanged)

## Impact

- **Database**: New `clients` table added to `app/data/schema.ts` and `app/data/setup.ts`
- **Code**: ~6 new files + modifications to 4 existing files (schema, setup, routes, router, nav)
- **Dependencies**: Uses existing `remix/data-table`, `remix/ui/theme`, `remix/ui/button`, `remix/ui/breadcrumbs` — no new dependencies
