## 1. Route and reference rename

- [x] 1.1 Rename the route key `client` → `clients` in `app/routes.ts` so `/admin/clients` is served at `routes.admin.clients`; verify `npm run typecheck` passes and `routes.admin.clients` is exported.
- [x] 1.2 Update `app/router.ts` to mount `routes.admin.clients` (was `routes.admin.client`); verify the router test passes (`npm test`).
- [x] 1.3 Update the `app/actions/admin/controller.tsx` re-export to map the renamed controller (e.g. `adminClients` → `routes.admin.clients`); verify typecheck passes.
- [x] 1.4 Replace every `/admin/client` string literal in `app/actions/client/controller.tsx`, `page.tsx`, `grid-page.tsx`, `edit-page.tsx`, `create-page.tsx`, and `app/actions/client/public/*` with `/admin/clients`; verify `grep -rn '/admin/client' app` returns only intended remaining mentions.
- [x] 1.5 Update the grid filter form `action` and the create/update/destroy redirects to `/admin/clients` so the `frame-form-intercept` and `programmatic-frame-reload` delta requirements are satisfied; verify the redirect location is `/admin/clients` in the controller tests.

## 2. Controller: shared grid-error renderer, session page size, audit logging

- [x] 2.1 Add a `renderClientsError` adapter (mirroring `renderUsersError` in `app/actions/admin/users/controller.tsx`) that delegates to `renderGridFormError<Row>`; verify it re-renders the clients page at HTTP 200 with preserved grid state.
- [x] 2.2 Replace the ad-hoc `renderAdminPage(..., { status: 400 })` calls in the create and update actions with the new adapter, passing `formValues` and `fieldErrors`; verify a validation failure returns status 200 with the submitted values and per-field errors preserved (controller test).
- [x] 2.3 Use `getPageSize(context.session, PAGE_SIZE)` for the grid page size in index/create/update; verify the page size respects the session preference.
- [x] 2.4 Add `logAdminAction` calls for create, update, and destroy (actor id/email, type, target `clients`, id, details); verify audit-log rows are written in the controller test when an admin identity is present.
- [x] 2.5 Align the `ClientPage` props with the shared grid-error shape (add `prevOffset`/`nextOffset`, `fieldError`/`formError`, rename `sortField`/`sortOrder` → `sortColumn`/`sortDirection`) and update all call sites; verify typecheck passes.

## 3. Status model: filter tabs, status column, toggle action with guards

- [x] 3.1 Extend the grid filter predicate to support `active` (`status = 'Active'`), `inactive` (`status = 'Inactive'`), numeric `id`, and free-text name/email ILIKE; verify a status filter returns only matching rows (controller test).
- [x] 3.2 Render Status filter tabs (All / Active / Inactive) and a Status column with an Active/Inactive badge in `grid-page.tsx`, reusing the `admin-table` mixins (`filterTab`, `statusBadge`); verify the rendered HTML includes the tabs and badges.
- [x] 3.3 Add a `toggleStatus` action to `routes.admin.clients` and the controller that flips `status` between `Active` and `Inactive`, preserves grid state in the redirect, audit-logs the change, and refuses an invalid/missing target with a surfaced reason (flash); verify with a controller test.

## 4. Row actions: remove inline JSON edit, server-rendered actions, context menu

- [x] 4.1 Remove the JSON email-edit branch of the `update` action and the `client-grid-inline-edit.tsx` client entry (plus any dependent grid-refresh client entry); verify no grid row action issues a `fetch`/XHR JSON mutation (conformant with `admin-page-base`).
- [x] 4.2 Render edit / toggle-status / delete as server-rendered forms or links with `data-rmx-target={frames.adminContent}`, `GridStateHiddenInputs`, and `ConfirmDelete`; verify each row action is a server-rendered form targeting the admin content frame.
- [x] 4.3 Add an `AdminClientsContextMenu` client entry under `app/actions/client/public/` (mirroring `admin-users-context-menu`); verify it is colocated and wired.

## 5. Tests and final verification

- [x] 5.1 Update `app/actions/client/controller.test.ts` for the `/admin/clients` path and add coverage for the status toggle, its guard, audit logging, and the shared-error 200 re-render; verify `npm test` for that file passes.
- [x] 5.2 Update `app/actions/client/grid-auto-refresh.test.ts` and any other client tests that reference `/admin/client` to the renamed path; verify `npm test` passes.
- [x] 5.3 Run `npm run typecheck` and `npm test` and confirm the full suite is green.
