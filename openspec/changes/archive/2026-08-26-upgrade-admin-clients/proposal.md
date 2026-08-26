## Why

The admin clients grid (`/admin/client`, the "Client Lab" page over the `clients` table) has fallen behind the production-grade `/admin/users` page. It lacks status filtering and status toggling, writes no admin audit log, routes validation failures through ad-hoc `renderAdminPage(..., { status: 400 })` calls instead of the shared grid-error path, and its URL (singular `client`) disagrees with the plural `clients` table it manages. This change brings the clients admin page to the same feature level, backend robustness, and conventions as users.

## What Changes

- **BREAKING (URL):** Rename the route key `client` → `clients` and the URL `/admin/client` → `/admin/clients` across `routes.ts`, `router.ts`, the admin controller re-export, the client controller and its page components, grid/redirect URL helpers, and tests.
- **Grid UX parity with users:** add a Status column with a badge, Status filter tabs (All / Active / Inactive), a consistent search field, and reuse the shared sort/pagination/cancel/filter URL helpers (`buildSortUrl`, `buildPaginationUrl`, `buildCancelUrl`, `buildFilterParams`) plus a per-row context menu.
- **Status toggle action + guards:** add an enable/disable row action (mirroring users' `toggleDisabled`) with guards so a client can only be toggled when allowed, and audit-log the change.
- **Backend robustness parity:** log admin create/update/destroy/status actions via `logAdminAction`; re-render validation failures through the shared `renderGridFormError` path so grid state and submitted form values are preserved; use the session page size via `getPageSize`.
- **Conform to `admin-page-base`:** replace the client-side inline email `fetch` JSON mutation with a server-rendered row action, so no row action issues a client-side data mutation request.

**Non-goals (confirmed out of scope):** no `clients` schema/data-model changes — the `registered` "year must be 2026" rule, the `name` `minLength(8)` rule, and the `clients` table columns are preserved as-is. The main-navigation "Client Lab" link is left as-is (it is not part of this change).

## Capabilities

### New Capabilities

- `admin-clients`: the behavior contract for the `/admin/clients` admin grid — CRUD, sorting/filtering/pagination, status toggle with guards, admin audit logging, validation re-render with preserved grid state, and conformance to the shared admin-page-base frame contract.

### Modified Capabilities

- `frame-form-intercept`: the grid filter form `action` changes from `/admin/client` to `/admin/clients` (path rename only).
- `programmatic-frame-reload`: the CRUD redirect destination changes from `/client` to `/admin/clients` (path rename only).

## Impact

**Code:** `app/routes.ts` (route key `client` → `clients`), `app/router.ts` (`routes.admin.client` → `routes.admin.clients`), `app/actions/admin/controller.tsx` (re-export), `app/actions/client/controller.tsx`, the client page components (`page.tsx`, `grid-page.tsx`, `edit-page.tsx`, `create-page.tsx`), `app/actions/client/public/*`, and the client controller/page tests. No database schema or API dependency changes; the `clients` table and `Client` type are unchanged. The source directory `app/actions/client/` is left in place (only the route key and URL path are renamed) to avoid broad file-path churn outside the route contract.
