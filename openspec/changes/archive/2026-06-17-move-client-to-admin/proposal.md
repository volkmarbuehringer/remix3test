## Why

The `/client` route exists at the top level but is admin-oriented functionality (managing client data). It should live under `/admin/client` to consolidate admin functionality in one route tree, consistent with `/admin/nutzer` and other admin sub-routes. This also enables the admin sidebar layout with frame-based navigation.

## What Changes

- **Route relocation**: Move `/client` from top-level `routes.client` to `routes.admin.client` under `/admin/client`
- **Controller middleware**: Add `requireAdmin()` alongside `requireAuth()`
- **Layout upgrade**: Switch from direct `<Layout>` wrapping to `renderAdminPage()` with admin sidebar
- **Frame navigation**: Replace standalone `client-grid` frame with `admin-content` frame
- **Navigation**: Remove "Client Lab" from top nav; update admin sidebar href to `/admin/client`
- **Controller directory**: Move `app/actions/client/` to `app/actions/client/` (keep co-located, matching nutzer pattern where controller lives outside admin/ dir but page components move to `app/ui/`)
- **URL references**: Update all internal URLs, redirects, and route references throughout the codebase

## Capabilities

### New Capabilities

- `admin-client`: Admin client management under `/admin/client` with admin sidebar layout, frame navigation, and admin-only access control

### Modified Capabilities

_(none — this is a relocation, not a behavior change)_

## Impact

- `app/routes.ts`: Move `client` route entry under `admin` route object
- `app/router.ts`: Change `router.map(routes.client, ...)` to `router.map(routes.admin.client, ...)`
- `app/actions/client/controller.tsx`: Add `requireAdmin()` middleware, switch to `renderAdminPage()` layout, remove `renderAdminPage` and `context.render` references
- `app/actions/client/page.tsx`: Update frame target from `frames.clientGrid` to `frames.adminContent`
- `app/actions/client/grid-page.tsx`: Update frame target, navigation URLs
- `app/actions/client/edit-page.tsx`: Update cancel/form action URLs
- `app/actions/client/create-page.tsx`: Update cancel/form action URLs
- `app/actions/client/controller.test.ts`: Update route references
- `app/actions/client/edit-page.test.ts`: Update route references
- `app/actions/client/grid-page.test.ts`: Update route references
- `app/actions/client/grid-auto-refresh.test.ts`: Update route references
- `app/ui/admin-layout.tsx`: Update client nav item href from `routes.client.index.href()` to `routes.admin.client.index.href()`, remove `iframeNav: false`
- `app/ui/nav.ts`: Remove "Client Lab" entry
- `app/ui/route-labels.ts`: Add/update breadcrumb label for `/admin/client`
- `app/middleware/auth.ts`: Ensure auth module exported for import (already available)
