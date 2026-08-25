## 1. Controller — base-contract conformance

- [x] 1.1 Drop `{ status: 400 }` on every validate-failure path in `app/actions/verwaltung/appointments/controller.tsx` (create/update schema failure, missing/invalid resource or user, `end <= start`, past-date, not-bookable, exclusion, rate-limit) so they re-render at 200. Verify: `npm run typecheck` passes and the existing `appointments-create.test.ts`/`appointments-update.test.ts` 400 assertions are updated to 200.
- [x] 1.2 Add a `appointmentsGridUrl(formData)` helper (mirroring `offeringsGridUrl`) and replace the `errorRedirectDestroy` helper and the invalid-id/not-found/rate-limit `?error=` or 400-with-`formError` paths in update and destroy with `session.flash('error', msg)` + `redirect(appointmentsGridUrl(formData))`. Verify: destroy of a missing id and an update of a not-found row return 302, and the flash error is readable from the session.
- [x] 1.3 Preserve grid state on create/update/delete success redirects — replace the `{ ...gridValues, period: '', filter: '', offset: '', status: '' }` strip logic with `gridStateToParams(gridStateFromFormData(formData))` (keep `editing=<id>` on create). Verify: the `appointments-create.test.ts`/`appointments-destroy.test.ts` assertions that expect `!location.includes('status=')` are updated to expect `status=` (and `period`/`filter`) preserved.
- [x] 1.4 Confirm the rate-limit guards still return the same message text and keep the `process.env.NODE_ENV !== 'test'` guard so the limiter does not interfere with tests. Verify: `npm test` green including the create/update/destroy suites.

## 2. Context menu — frame-aware edit

- [x] 2.1 In `app/actions/admin/public/admin-appointments-context-menu.tsx`, import `safeNavigate` from `../../../utils/frame-utils.ts` and replace both `window.location.href = ...` uses in `handleEditAction` (and its catch fallback) with `safeNavigate(<href>, handle)`. Verify: `npm run typecheck` passes; the menu edit navigates the frame (no full-document `window.location.href`).

## 3. Form — IntervalBounds end-time gating

- [x] 3.1 In `app/ui/admin-appointments-form.tsx`, import `IntervalBounds` from `./interval-bounds.browser.tsx` and render `<IntervalBounds startId={isEdit ? 'ae-start' : 'ac-start'} endId={isEdit ? 'ae-end' : 'ac-end'} />` inside the form. Verify: `npm run typecheck` passes and lowering the start snaps the end to the first valid value.

## 4. Page + data query — UX parity

- [x] 4.1 In `app/ui/admin-appointments-page.tsx`, extend the status tab loop from `['pending','expired']` to `['all','pending','expired']` with an `Alle` label and fix the active-tab self-link so re-clicking a non-default tab keeps its own filter. Verify: `npm test` (appointments-index.test.ts) covers an `status=all` request that returns both past and future rows.
- [x] 4.2 In `app/data/appointments.ts` `listAppointments`, add a `status === 'all'` branch (no `a.date` day filter) before the `pending`/`expired` branches. Verify: `appointments-index.test.ts` has a case asserting `status=all` shows past + future, and it passes.
- [x] 4.3 Ensure the period filter controls stay enabled on the `all` status tab (only `status === 'expired'` disables them). Verify: a `status=all` render shows active period tabs.
- [x] 4.4 Add an empty-state `Neu anlegen` CTA (frame-targeted `buildCreateUrl`) in `app/ui/admin-appointments-page.tsx` when `rows.length === 0` and no form panel is active. Verify: the empty-state test/render shows the CTA only when not creating/editing.

## 5. Tests — confirm the new contract

- [x] 5.1 Update `app/actions/verwaltung/appointments-create.test.ts` and `appointments-update.test.ts` to assert 200 inline-error re-renders (with preserved `formValues`/`fieldErrors`) and add a case asserting a non-field guard (missing id / not-found) redirects with a flash error. Verify: `npm test` green.
- [x] 5.2 Update `app/actions/verwaltung/appointments-destroy.test.ts` to assert the FK-constraint block and not-found paths redirect with a `session.flash` error and preserve grid state. Verify: `npm test` green.
- [x] 5.3 Update `app/actions/verwaltung/appointments-index.test.ts` for the `status=all` view and mutation-redirect grid-state preservation. Verify: `npm test` green.
- [x] 5.4 Run the full verification: `npm test`, `npm run typecheck`, `npm run format:fix`. Verify: all pass with no unintended failures beyond the updated expectation changes.

## 6. Post-apply fix — GET /:id for a deleted row must not 404

- [x] 6.1 In the `show` action, redirect (PRG) to the appointments grid when the row is not found instead of rendering a 404 "Eintrag nicht gefunden." card, so the frame's GET of the committed `/:id` action path after a successful delete resolves to the grid. Verify: the new destroy test "GET /verwaltung/appointments/:id for a deleted row redirects to the grid, not 404" passes.
