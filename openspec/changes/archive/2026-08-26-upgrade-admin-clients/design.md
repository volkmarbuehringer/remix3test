## Context

See proposal.md - Why. The current clients admin controller (`app/actions/client/controller.tsx`) serves `/admin/client` over the `clients` table with CRUD, sorting, and a name/email filter, but diverges from the users admin page (`app/actions/admin/users/controller.tsx`) in several ways that this change closes. The users controller is the reference: it uses a `createController` with `renderGridFormError` for 400 re-renders, session page size, audit logging, a status toggle with guards, status filter tabs, and a server-rendered row action set.

## Goals / Non-Goals

**Goals**

- Rename the route key and URL to `/admin/clients` and wire every reference without leaving stale `/admin/client` / `routes.admin.client` usages.
- Bring the clients grid to the same controls, status model, audit trail, and validation handling as the users page.
- Conform to the shared `admin-page-base` frame contract (server-rendered row actions, PRG, no client-side row mutation).

**Non-Goals**

- No `clients` schema/table/type changes; preserve the `registered` "year must be 2026" rule and the `name` `minLength(8)` rule.
- No change to the main-navigation "Client Lab" link (currently absent; out of scope).
- No route-level redirect from the old `/admin/client` path — it simply 404s after the rename (documented trade-off).

## Decisions

### 1. Route rename scope: URL + route key only, source directory stays

Rename the route key and URL path (`client` → `clients`) in `app/routes.ts`, and update every reference: `app/router.ts` (`routes.admin.client` → `routes.admin.clients`), the `app/actions/admin/controller.tsx` re-export, and all `routes.admin.client.*` / `/admin/client` strings in the controller, page components, and tests. The source directory `app/actions/client/` is left as-is to avoid a wide file-path sweep that would also ripple into the asset allow-list and `browser-source-colocation` spec.

Alternatives considered: renaming the directory too (rejected — larger churn, no behavioral benefit) and keeping the singular path (rejected — conflicts with the plural `clients` table and the confirmed request).

### 2. Reuse the shared grid-error renderer

Add a `renderClientsError` adapter mirroring the users `renderUsersError` (`app/actions/admin/users/controller.tsx`), delegating to `renderGridFormError<Row>` from `app/ui/admin-grid-error.tsx`. This replaces the current ad-hoc `renderAdminPage(..., { status: 400 })` calls in the create/update actions and gives the frame transport inline field errors with preserved grid state for free.

To feed the shared renderer, align the page component props with the shared grid-error shape: add `prevOffset`/`nextOffset`, `fieldError`/`formError`, and rename `sortField`/`sortOrder` → `sortColumn`/`sortDirection`. Keep rendering the existing `ClientPage` (grid + side panel) so the layout stays familiar.

### 3. Status model: filter tabs, status column, and toggle action

- Filter predicate: `active` → `status = 'Active'`, `inactive` → `status = 'Inactive'`, numeric → `id`, free text → `name`/`email` ILIKE. Render Status filter tabs (All / Active / Inactive) and a Status column with an Active/Inactive badge, using the shared `admin-table` mixins (`table.filterTab`, `table.statusBadge`, etc.).
- Add a `toggleStatus` action to the `routes.admin.clients` route map (mirroring users' `toggleDisabled`). It flips `status` between `Active` and `Inactive`, preserves grid state in the redirect, and audit-logs the change.
- Guard: the toggle SHALL refuse when the target is missing/invalid (invalid or non-positive id, or row not found) and surface the reason (flash). No `self`/`last-admin` business-rule lockout applies because `clients` is not an authentication table — the structural guard (valid target) is the users-parallel.

### 4. Audit logging

Call `logAdminAction` (`app/data/audit-log.ts`) on every create, update, destroy, and status-toggle for the clients grid, with the actor admin id/email, action type, target type `clients`, target id, and a details payload. This mirrors the users controller. `logAdminAction` is called only when an admin identity is available.

### 5. Replace the client-side inline JSON email edit

The grid currently edits a row's email via `fetch('/admin/client/:id', { method: 'PUT', json })` in `app/actions/client/public/client-grid-inline-edit.tsx`, which violates `admin-page-base` (row actions must not issue a JSON mutation via fetch/XHR). Replace it with the server-rendered edit panel (already PUT-form based), remove the JSON branch of the `update` action and the inline-edit client entry, and drop the now-unused grid refresh client entry if it depended on that path. This is the one behavioral removal required to conform to the base contract.

### 6. Row actions and context menu

Render per-row edit / toggle-status / delete actions as server-rendered forms or links with `data-rmx-target={frames.adminContent}`, `GridStateHiddenInputs`, and the shared `ConfirmDelete` for the destructive path — matching the users page. Add an `AdminClientsContextMenu` client entry under `app/actions/client/public/` (mirroring `admin-users-context-menu`) if a row context menu is added.

### 7. Session page size

Use `getPageSize(context.session, PAGE_SIZE)` for the grid page size (replacing the current fixed page size path), matching the users controller.

## Risks / Trade-offs

- **Old `/admin/client` URLs 404 after rename** → intentional; document in the change. No redirect is added to keep the route tree clean; noted so callers update bookmarks/links.
- **Dropping the inline email edit removes a quick-capture affordance** → email editing remains fully available in the server-rendered edit panel; net-conformant with `admin-page-base`.
- **Prop rename and shared-renderer adoption touch the grid/edit/create page components** → update all call sites in the same change and extend the controller tests to cover the new `renderGridFormError`-based 400 path.
- **Keeping the directory `app/actions/client/` while renaming the route** is mildly inconsistent, but avoids asset-allowlist and colocation-spec churn.
- **The `registered` "year 2026" and `minLength(8)` rules remain** → they are explicitly out of scope and preserved; flagged so no one expects them resolved here.

## Migration Plan

- This is a controller + route + page + test change; no database migration.
- Apply order: rename the route and update references → refactor the controller to the shared grid-error renderer, session page size, and audit logging → add the status filter/column/toggle → replace the inline JSON edit → update/extend tests → `npm run typecheck` and `npm test`.
- Rollback: revert the commit(s); the only irreversible external effect is the URL rename (old bookmarks), which is documented.

## Open Questions

- None blocking. The optional question of adding a redirect from `/admin/client` was resolved (no redirect; intentional 404) in this design.
