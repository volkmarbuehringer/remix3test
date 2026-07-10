## Context

The `/client` route is currently a standalone top-level route (`routes.client`) at path `/client`. It has its own controller at `app/actions/client/controller.tsx` with co-located page components, uses `requireAuth()` middleware, and renders via direct `<Layout>` wrapping. It manages a `clients` DB table with CRUD operations, grid pagination, sort, filter, and inline editing.

The `/admin/nutzer` route (`routes.admin.nutzer`) at path `/admin/nutzer` serves as the reference pattern: it uses `createController(routes.admin.nutzer, ...)` with `requireAuth() + requireAdmin()` middleware, renders via `renderAdminPage()` (admin sidebar layout with frame-based navigation), and its controller lives at `app/actions/nutzer/controller.tsx` (not under `app/actions/admin/`).

The goal is to move `/client` under `/admin/client`, matching the `/admin/nutzer` architecture while keeping as much of the existing controller logic intact.

## Goals / Non-Goals

**Goals:**

- Relocate `/client` route from top-level to `routes.admin.client` at `/admin/client`
- Add `requireAdmin()` middleware alongside `requireAuth()`
- Switch rendering from `<Layout>` to `renderAdminPage()` with admin sidebar
- Replace standalone `client-grid` frame target with `admin-content` frame
- Remove "Client Lab" from top nav; update admin sidebar nav entry
- Update all internal URL references, redirects, and form actions

**Non-Goals:**

- Changing the DB schema, data model, or business logic
- Rewriting the grid or page components — keep existing inline edit, CRUD, pagination, sorting, filtering
- Changing the nutzer pattern or other admin routes
- Refactoring `context.db` to raw SQL (client uses ORM-style, nutzer uses raw SQL)

## Decisions

### 1. Controller stays at `app/actions/client/controller.tsx`

**Rationale:** Matches the nutzer pattern where `app/actions/nutzer/controller.tsx` serves `routes.admin.nutzer` despite not being under an `admin/` directory. Moving it would create unnecessary churn.

### 2. Page components stay co-located (not moved to `app/ui/`)

**Rationale:** The nutzer pattern has page components in `app/ui/`, but the client page components are tightly coupled to the client controller's data flow (grid state, inline edit, etc.). Moving them adds risk without benefit. The `renderAdminPage()` function is a layout wrapper — page content components don't need to live in `app/ui/` to use it. However, we will move them if the renderAdminPage pattern requires it.

**Update after deeper analysis:** The nutzer page components live in `app/ui/` because they are shared with other admin routes. The client page components are narrow — they only serve this route. Keep them co-located to minimize diff and risk.

### 3. Frame navigation: Replace `client-grid` with `admin-content`

**Rationale:** After moving to `/admin/client`, the page will be rendered inside the admin sidebar layout via `renderAdminPage()`. The sidebar layout already manages frame navigation via `admin-content`. We replace the `Frame(name=frames.clientGrid, ...)` with the layout-managed frame. The grid fragment endpoint changes from `/client/grid` to `/admin/client/grid`.

### 4. Route key: `routes.admin.client`

**Rationale:** Consistent with `routes.admin.nutzer`, `routes.admin.chatlog`, etc.

### 5. Remove `frames.clientGrid` from routes.ts

**Rationale:** No longer needed. The admin layout manages its own `admin-content` frame.

### 6. URL string updates: use `routes.admin.client` references instead of hardcoded `/client`

**Rationale:** Using route references (`routes.admin.client.index.href()`) for all internal links provides type safety and makes future changes easier. Hardcoded URLs (`/admin/client`) are acceptable in templates where route references are not available.

## Risks / Trade-offs

- **Grid content vs admin-content frame**: Currently the client page has a separate `Frame(name=frames.clientGrid, src=...)` inside the page. The admin layout's `renderAdminPage()` also manages a frame (`admin-content`). To avoid double-framing, the client page will no longer use its own Frame — it will render the grid content directly (or via the admin layout's frame). This changes the grid loading pattern from a nested Frame to a direct content area.

  **Resolution**: The nutzer pattern renders the grid directly in the page content (no separate Frame). We'll follow that pattern: the admin page renders grid content inline inside `renderAdminPage()`.

- **Inline edit asset (`client-grid-inline-edit.tsx`)**: This clientEntry module references `#client-grid-content` for DOM queries and fetches to `/client/${rowId}`. The selectors still work after the move — only the fetch URL needs updating to `/admin/client/${rowId}`.

- **Grid state management**: The grid section (`#client-grid-section`) will become the admin frame content area. Hidden inputs and URL params should continue working.

- **Test updates**: 4 test files reference `/client` URLs and `client-grid` frame. These all need updating to use `/admin/client` URLs.

## Migration Plan

1. Update `app/routes.ts`: Move `client` route entry into `admin` route object
2. Update `app/router.ts`: Change `router.map(routes.client, ...)` to `router.map(routes.admin.client, ...)`
3. Update `app/actions/client/controller.tsx`:
   - Change `createController(routes.client, ...)` to `createController(routes.admin.client, ...)`
   - Add `requireAdmin()` to middleware array
   - Replace `import { Layout } from '../../ui/layout.tsx'` with `import { renderAdminPage } from '../../ui/admin-layout.tsx'`
   - Replace `context.render(<Layout title="Client">...)` with `renderAdminPage(context.render, 'client', ...)`
   - Update all hardcoded `/client/...` URLs to `/admin/client/...`
4. Update `app/actions/client/page.tsx`:
   - Remove `Frame` import and `frames` reference
   - The grid is rendered directly (no wrapping Frame) since `renderAdminPage` handles frame management
5. Update `app/actions/client/grid-page.tsx`:
   - Replace `rmx-target="client-grid"` with `rmx-target="admin-content"` or remove frame targets (content is rendered inline now)
   - Update all hardcoded `/client` URLs to `/admin/client`
6. Update `app/actions/client/edit-page.tsx`:
   - Update form action URL from `/client/${row.id}` to `/admin/client/${row.id}`
   - Update cancel URL from `/client` to `/admin/client`
7. Update `app/actions/client/create-page.tsx`:
   - Update form action URL from `/client` to `/admin/client`
   - Update cancel URL from `/client` to `/admin/client`
8. Update `app/assets/client-grid-inline-edit.tsx`: Update fetch URL from `/client/${rowId}` to `/admin/client/${rowId}`
9. Update `app/ui/admin-layout.tsx`:
   - Change nav href from `routes.client.index.href()` to `routes.admin.client.index.href()`
   - Remove `iframeNav: false` (content loads in admin frame now)
10. Update `app/ui/nav.ts`: Remove "Client Lab" entry
11. Update `app/ui/admin-page.tsx`: Update `routes.client.index.href()` to `routes.admin.client.index.href()` for dashboard card
12. Update `app/route-labels.ts`: Rename route labels from `routes.client.*` to `routes.admin.client.*`
13. Update 4 test files: Replace `/client` with `/admin/client` in URLs
14. Remove `frames.clientGrid` from routes.ts (no longer needed)
15. Run `npm run typecheck` and `npm test` to verify
