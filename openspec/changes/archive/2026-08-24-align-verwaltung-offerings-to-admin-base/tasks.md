## 1. Controller: 200 re-render + flash/PRG

- [x] 1.1 In app/actions/verwaltung/offerings/controller.tsx, remove `{ status: 400 }` from every create/update validation re-render (schema issues, end<=start, holiday, past date, exclusion constraint) so the fragment is rendered at status 200 with inline `fieldErrors`/`formError` and preserved `formValues`. Verify: `node_modules/.bin/openspec validate align-verwaltung-offerings-to-admin-base` passes and `npm run typecheck` passes.
- [x] 1.2 In update/destroy, replace the `context.json({ ok: false, error })` returns (invalid id, not found) with a redirect to the grid URL (grid-state preserved) plus `context.session.flash('error', message)`. Verify: grep for `context.json` in the offerings controller returns no mutation error path; `npm test -- offerings` passes.
- [x] 1.3 In configSave, replace the JSON-400 parse-failure return with redirect + `session.flash`; on success redirect to the grid URL with grid-state params preserved (currently it drops them). Verify: a config-save success test asserts a 3xx redirect carrying offset/sort/order/filter and no `?error=` param.
- [x] 1.4 In weekGenerate and deletePast, replace the `?error=` query-param message with `context.session.flash(...)` and redirect to the grid URL with grid-state preserved. Verify: the corresponding tests assert a 3xx redirect plus a flash instead of `?error=` in the URL.

## 2. Page: visible server-rendered row actions

- [x] 2.1 In app/ui/admin-offerings-page.tsx, add a row action cell to each table row with a server-rendered edit anchor (href = grid URL with `editing=<id>` + offset/sort/order/filter/period/status) using `data-rmx-target={frames.adminContent}`. Verify: a rendered offerings fragment contains a per-row `a[data-rmx-target="admin-content"]` edit link; `npm run typecheck` passes.
- [x] 2.2 Add a per-row DELETE `RestfulForm` (method DELETE, action = destroy href) carrying `data-delete-form={row.id}`, `data-confirm`, `data-rmx-target={frames.adminContent}`, and `GridStateHiddenInputs` (offset/sort/order/filter/period/status). Verify: the fragment contains `form[data-delete-form]` with `data-rmx-target="admin-content"`; `npm run typecheck` passes.
- [x] 2.3 Remove the existing hidden bulk DELETE forms block (the visible per-row form now carries `data-delete-form`), and confirm the grid-state JSON blob (`#offerings-grid-state`) includes `period` and `status`. Verify: `grep -n "data-delete-form" app/ui/admin-offerings-page.tsx` shows one DELETE form per row and no hidden bulk block; `npm run typecheck` passes.

## 3. Context menu: input affordance only

- [x] 3.1 In app/actions/admin/public/admin-offerings-context-menu.tsx, replace the edit action's `window.location.href` with frame-aware `safeNavigate(baseHref + '?' + params, handle)` (import from utils/frame-utils.ts) while preserving offset/sort/order/filter/period/status. Verify: `grep -rn "window.location.href" app/actions/admin/public/admin-offerings-context-menu.tsx` returns nothing; `npm run typecheck` passes.
- [x] 3.2 Keep the delete menu item submitting the row's `form[data-delete-form]` via `form.requestSubmit()` (guarded for null), matching the visible per-row form. Verify: `grep -rn "requestSubmit" app/actions/admin/public/admin-offerings-context-menu.tsx` shows the delete path and no `fetch(` mutation call.

## 4. Flash surfacing in the verwaltung fragment path

- [x] 4.1 In app/ui/verwaltung-layout.tsx, add a flash (error + success) banner to the content-only fragment path (when `X-Remix-Target` is a frame target), reading `session.get('error'|'success')` like app/ui/layout.tsx and styled with theme tokens; leave the full-document path using the main `Layout`. Verify: `npm run typecheck` passes; a frame-target fragment request with a flash set renders the banner text.
- [x] 4.2 Add/adjust a colocated test asserting the verwaltung fragment path renders the flash banner from session error/success. Verify: `npm test -- verwaltung-layout` (or the colocated test) passes.

## 5. Tests and verification

- [x] 5.1 Update app/actions/verwaltung/offerings-index.test.ts and any offerings create/update/destroy/config/week tests to assert status 200 inline-error re-renders (not 400) and redirect + flash for non-field errors (not `?error=` or JSON bodies). Verify: `npm test -- offerings` passes.
- [x] 5.2 Confirm no client-side mutation path remains: `grep -rn "frame.reload\|fetch(" app/actions/verwaltung/offerings app/actions/admin/public/admin-offerings-context-menu.tsx` returns no mutation call beyond the confirm/context affordances. Verify: the grep is clean; `npm run typecheck` passes.
- [x] 5.3 Run the full verification: `npm run typecheck`, `npm test`, and `node_modules/.bin/openspec validate align-verwaltung-offerings-to-admin-base`. Verify: all pass.
