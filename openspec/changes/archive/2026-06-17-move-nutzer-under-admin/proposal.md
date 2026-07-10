## Why

The `/nutzer` page currently lives as a standalone top-level route, rendering outside the admin sidebar Frame layout. This creates an inconsistent UX — admins get the sidebar for users, chatlog, messages, etc., but not for nutzer. Moving it under `/admin/nutzer` gives it the same sidebar navigation, breadcrumbs, and Frame-based navigation as every other admin page.

Previous attempts hit a wall: form validation errors didn't render correctly inside the Frame. The root cause is three interacting issues — missing `rmx-target` attributes, hardcoded `/nutzer` URLs, and the controller using `<Layout>` directly instead of `renderAdminPage()`.

## What Changes

- **Route relocation**: Move `nutzer{}` from top-level into `admin{}` in `routes.ts`
- **Router wiring**: Change `router.map(routes.nutzer, ...)` → `router.map(routes.admin.nutzer, ...)`
- **Controller rendering**: Switch from `context.render(<Layout title="Nutzer">...)` to `renderAdminPage(context.render, 'nutzer', ...)` for all actions, including render-on-error paths with `{ status: 400 }`
- **Frame-aware navigation**: Add `rmx-target={frames.adminContent}` to all navigational elements in `admin-nutzer-page.tsx` (filter form, sort links, pagination, "Neu anlegen", clear filter)
- **URL updates**: Change all hardcoded `/nutzer` paths to `/admin/nutzer` or use route references — in `ADMIN_BASE`, form actions, redirects, `fetch()` calls in `nutzer-table-interactive.tsx`, and the nav link
- **Nav integration**: Add `'nutzer'` to `AdminNavItem` and `NAV_GROUPS` in `admin-layout.tsx`
- **Test updates**: Update ~40 `/nutzer` references in `controller.test.tsx`, plus `rmx-target` assertions

## Capabilities

### New Capabilities

- `admin-sidebar-framed-page`: Pattern for hosting a render-on-error admin CRUD page inside the admin sidebar Frame layout, with inline field errors surviving Frame navigation

### Modified Capabilities

- _(none — no spec-level requirement changes)_

## Impact

| Area                                      | Impact                                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `app/routes.ts`                           | Move `nutzer` block into `admin` block                                                            |
| `app/router.ts`                           | One line change: `routes.nutzer` → `routes.admin.nutzer`                                          |
| `app/actions/nutzer/controller.tsx`       | ~6 `context.render()` calls switch from `<Layout>` to `renderAdminPage()`; 3 redirect URLs change |
| `app/ui/admin-nutzer-page.tsx`            | Add `rmx-target` to ~6 elements; change `ADMIN_BASE`                                              |
| `app/ui/admin-nutzer-edit-page.tsx`       | Form action + cancel URL                                                                          |
| `app/ui/admin-nutzer-create-page.tsx`     | Form action + cancel URL                                                                          |
| `app/assets/nutzer-table-interactive.tsx` | 5 fetch/URL references                                                                            |
| `app/ui/admin-layout.tsx`                 | Add nav item                                                                                      |
| `app/ui/nav.ts`                           | Update href                                                                                       |
| `app/actions/nutzer/controller.test.tsx`  | ~40 URL references + rmx-target assertions                                                        |
