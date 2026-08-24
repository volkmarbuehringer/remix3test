## 1. /admin/users — toggle becomes a server form with PRG

- [x] 1.1 In `app/ui/admin-users-page.tsx`, replace the row toggle `<button type="button" data-toggle-disabled>` with a `RestfulForm method="POST"` action `routes.admin.users.toggleDisabled.href({ id: row.id! })`, `data-rmx-target={frames.adminContent}`, `data-toggle-form={row.id}`, containing `GridStateHiddenInputs` and the shield/check submit button. Verify: a rendered users fragment contains `form[data-toggle-form]` with `data-rmx-target="admin-content"` and has no `data-toggle-disabled` button; `npm run typecheck` passes.
- [x] 1.2 In `app/actions/admin/users/controller.tsx`, change `toggleDisabled` from `context.json(...)` to PRG: load the row, apply enable/disable, `redirect` to the grid index with grid-state params; on invalid/missing/protected record, `redirect` with `session.flash('error', ...)`. Verify: `npm test -- admin-users` toggle cases assert a 3xx redirect carrying grid-state params (and a flash on failure).
- [x] 1.3 Update `app/actions/admin/admin-users.test.ts` toggle-disabled cases to assert the PRG round-trip + flash instead of the JSON body. Verify: `npm test -- admin-users` passes.
- [x] 1.4 In `app/actions/admin/public/admin-users-context-menu.tsx`, remove the `fetch(...toggle-disabled)` call, the `meta[name=csrf-token]` read, and `frame.reload()`; make the activate/deactivate menu items submit the row's form via `data-toggle-form` + `form.requestSubmit()` (guarded for null). Verify: `grep -rn "toggle-disabled" app/actions/admin/public` shows no `fetch` mutation; `npm run typecheck` passes.

## 2. Flash banner in the admin sidebar shell

- [x] 2.1 Add a flash (error + success) banner to `createSidebarLayout`'s `LayoutComponent` in `app/ui/sidebar-layout.tsx`, reading `session.get('error'|'success')` exactly like `app/ui/layout.tsx`, rendered at the top of the content pane with theme tokens. Verify: `npm run typecheck` passes; a frame-target fragment request with a flash set renders the banner text.
- [x] 2.2 Add a test asserting the admin sidebar shell renders the flash banner from session error/success. Verify: `npm test -- sidebar-layout` (or the colocated layout test) passes.

## 3. Shared admin error-render helper

- [x] 3.1 Extract `renderAdminGridFormError` from the `users` controller's `renderUsersFormError` into a shared module (e.g. `app/ui/admin-grid-error.tsx`), generic over `render`, `activeItem`, page component, `{ formValues, fieldErrors, formError }`, and `grid` (`{ offset, sort, order, filter, pageSize }`), returning `renderAdminPage(..., { status: 200 })`. Verify: `npm run typecheck` passes.
- [x] 3.2 Refactor `app/actions/admin/users/controller.tsx` to use the shared helper and remove the duplicated local `renderUsersFormError`. Verify: `npm test -- admin-users` passes.

## 4. Convergence and verification

- [x] 4.1 Grep the admin actions/UI for any remaining client-mutating mutation path (bare `fetch(` to a mutation route or `frame.reload()` after a mutation) and confirm all row actions are server-rendered forms/links. Verify: `grep -rn "frame.reload\|fetch(" app/actions/admin/public app/ui/admin-*.tsx` returns no client-mutation call beyond the intended confirm/context affordances.
- [x] 4.2 Record the base as a reference contract (a short note in the README or codebase doc) so new admin pages follow it (controller + page template, `renderAdminGridFormError`, flash banner, grid-state round-trip). Verify: the note exists and references the base template and helpers.
- [x] 4.3 Run the full verification: `npm run typecheck`, `npm test`, and `node_modules/.bin/openspec validate standardize-admin-page-base`. Verify: all pass.
