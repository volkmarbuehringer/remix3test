## 1. Controller — base-contract conformance

- [x] 1.1 Drop `{ status: 400 }` on every validate-failure path in `app/actions/verwaltung/resources/controller.tsx` (create/update schema failure: short name, short description, over-long capabilities) so they re-render at 200. Verify: `npm run typecheck` passes and the existing `resources.test.ts` `rejects empty description` create/update 400 assertions are updated to 200.
- [x] 1.2 Add a `resourcesGridUrl(formData)` helper (mirroring `offeringsGridUrl`/`appointmentsGridUrl`) that builds the grid index URL from `gridStateToParams(gridStateFromFormData(formData))`. Verify: `npm run typecheck` passes and the helper is used by the update/destroy PRG redirects.
- [x] 1.3 Replace the update/destroy invalid-id `context.json({ ok: false, error: 'Invalid id' }, { status: 400 })` guard and the destroy not-found `context.json({ ok: false, error: 'Resource not found' }, { status: 404 })` guard with `context.session.flash('error', msg)` + `redirect(resourcesGridUrl(formData))`. Verify: the updated `resources.test.ts` destroy/update cases for a missing row return 302 and the flash error is readable from the session.
- [x] 1.4 Replace the destroy FK-constraint 400-with-`formError` re-render with `context.session.flash('error', 'Ressource wird noch verwendet und kann nicht gelöscht werden')` + `redirect(resourcesGridUrl(formData))`, keeping the `process.env.NODE_ENV !== 'test'` logger guard. Verify: the `resources.test.ts` FK-block case returns 302 with a flash error and preserves grid state.
- [x] 1.5 Standardise the create/update/destroy success redirects on `gridStateToParams(gridStateFromFormData(formData))` (keeping `editing=<id>` on create) replacing the `gridStateFromForm(parsed)` reads. Verify: `npm run typecheck` passes and the create/update/destroy redirect tests assert the `offset`/`sort`/`order`/`filter` params are preserved and `editing=` is set on create.
- [x] 1.6 The `show` GET `/:id` action PRGs to the grid when the row does not exist (or the id is invalid) instead of `renderResourcePage(context, data, { status: 404 })`; existing rows still render the inline edit panel at 200. Verify: a new `resources.test.ts` case asserts GET `/verwaltung/resources/:id` for a deleted row returns a 3xx redirect to the grid (not 404), and an existing-row GET renders the edit panel at 200.

## 2. Page — server-rendered frame-targeted row actions

- [x] 2.1 In `app/ui/admin-resources-page.tsx`, add a visible per-row action cell (`<td mix={table.actionCell}>` with a `buildEditUrl` edit link and a `RestfulForm method="DELETE"` per row), each carrying `data-rmx-target={frames.adminContent}` and wrapping the DELETE form in a `GridStateHiddenInputs` with `offset`/`sort`/`order`/`filter`. Add the matching `<col>` to the table `colgroup` and import `buildEditUrl`/`table.actionCell` if not already imported. Verify: `npm run typecheck` passes and the rendered row exposes a frame-targeted edit link and a DELETE form with `data-delete-form`/`data-confirm`.
- [x] 2.2 Add `data-rmx-target={frames.adminContent}` to the inline create and edit `RestfulForm` panels and to the existing hidden DELETE forms. Verify: `npm run typecheck` passes and the forms carry the frame target so create/update/delete navigate only the content frame.
- [x] 2.3 Add an empty-state `Neu anlegen` CTA (frame-targeted `buildCreateUrl`) when `rows.length === 0` and no form panel is active (`!hasFormPanel`, where `hasFormPanel = Boolean(editRow || creating)`). Verify: `npm run typecheck` passes and the empty-state test/render shows the CTA only when not creating/editing.

## 3. Context menu — frame-aware edit

- [x] 3.1 In `app/actions/admin/public/admin-resources-context-menu.tsx`, import `safeNavigate` from `../../../utils/frame-utils.ts` and replace both `window.location.href = ...` uses in `handleEditAction` (and its catch fallback) with `safeNavigate(<href>, handle)`. Verify: `npm run typecheck` passes; the menu edit navigates the content frame (no full-document `window.location.href`) and preserves the `editing`/`offset`/`sort`/`order`/`filter` params.

## 4. Tests — confirm the new contract

- [x] 4.1 Update `app/actions/verwaltung/resources.test.ts` create/update validation cases to assert 200 inline-error re-renders (with preserved `formValues`/`fieldErrors`) instead of 400. Verify: `npm test` green.
- [x] 4.2 Update the destroy cases: a non-existent resource and a resource still referenced (FK block) now redirect (302) with a `session.flash` error and preserve grid state; add an update-of-a-not-found-row flash case. Verify: `npm test` green.
- [x] 4.3 Add the mutation-redirect grid-state preservation assertions (create keeps `editing=` + offset/sort/order/filter; update/delete keep offset/sort/order/filter). Verify: `npm test` green.
- [x] 4.4 Add a case asserting GET `/verwaltung/resources/:id` for a deleted/missing resource redirects to the grid (not 404). Verify: `npm test` green.
- [x] 4.5 Run the full verification: `npm test`, `npm run typecheck`, `npm run format:fix`. Verify: all pass with no unintended failures beyond the updated expectation changes.

## 5. Post-apply check — agent JSON create path preserved

- [x] 5.1 Confirm the `X-Agent-Thread` create path in `app/actions/verwaltung/resources/controller.tsx` is unchanged (400 JSON on a bad payload, `{ status: 'created' }` on success) and is covered by its own test. Verify: `npm test` green and the resource-capability-agent test suite still asserts the JSON responses.
