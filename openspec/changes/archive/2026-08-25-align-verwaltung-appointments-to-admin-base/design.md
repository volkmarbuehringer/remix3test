## Context

See `proposal.md` — Why. `/verwaltung/appointments` already has server-rendered row actions (edit link + DELETE form with `GridStateHiddenInputs`), `ConfirmDelete`, the context menu, and the shared `verwaltung` fragment flash banner (`renderVerwaltungPage` in `app/ui/verwaltung-layout.tsx`). What remains is the base-contract behavior in the controller and the UX parity items. This design covers only HOW those are brought into line; the requirements live in `specs/verwaltung-appointments-admin-base/spec.md` and the `specs/admin-appointments-form-validation/spec.md` delta.

## Goals / Non-Goals

Goals
- Bring `/verwaltung/appointments` mutations onto the same base contract as `/verwaltung/offerings`/`/admin/users`: 200 inline-error re-renders, `session.flash` PRG for non-field errors, grid-state round-trip.
- Keep the appointments-specific features intact: per-user field, `isSlotBookable` booking-slot validation, `appointmentChannel.broadcast('invalidate')` SSE, per-user rate limiting, default start/end derived from the resource's offerings.
- Add the applicable UX parity: `IntervalBounds` end-time gating, an `Alle` status tab, and an empty-state `Neu anlegen` CTA.

Non-Goals
- Do NOT port offerings-only features: per-resource config action, week-generate, delete-past, KW/WD column collapse, `countPastOfferings`/`deletePastOfferings`.
- Do NOT remove the appointments rate limiter or the SSE `invalidate` broadcast — those are appointments-domain behavior, not part of the offerings codestate.
- Do NOT change the slot-not-bookable, past-date, overlap, or user-field validation rules themselves — only the response status/transport they use.

## Decisions

### D1. Validation failures re-render at 200, not 400
Drop `{ status: 400 }` on every `renderAppointmentsPage(...)` call in `create`/`update` (schema failure, missing/invalid resource or user, `end <= start`, past-date, not-bookable, exclusion, rate-limit) so they render as 200. Rationale: the shared frame transport treats a non-OK fragment as an unrecoverable error card; the base contract (and `verwaltung-offerings-admin-base`) requires an OK inline-error fragment. Alternative considered: keep 400 and only special-case the frame — rejected because it diverges from the established contract and the offerings/`/admin/users` behavior. This requires updating the many `assert.equal(response.status, 400, ...)` assertions in `appointments-create.test.ts`/`appointments-update.test.ts` to 200.

### D2. Non-field errors move to `session.flash` + PRG
Replace the `errorRedirectDestroy(formData, msg)` helper (which sets `?error=`) and the internal 400-with-`formError` guards with a flash + redirect helper mirroring `offeringsGridUrl(formData)` (e.g. `appointmentsGridUrl(formData)` using `gridStateToParams(gridStateFromFormData(formData))`). Apply to: update/destroy invalid id, update/destroy not-found row, destroy FK-constraint violation. Keep the page-level `error` banner only for the index/show URL-error path (`show` 404 renders `error` via override). Rationale: `?error=` is now dead in the base contract (the fragment path renders flash via the shared `verwaltung` banner); messages passed through the URL are also not observable after navigation.

### D3. Grid state round-trips on create/update/delete redirects
Replace the redirect form `params = gridStateToParams({ ...gridValues, period: '', filter: '', offset: '', status: '' })` (which blanks the grid) with `gridStateToParams(gridStateFromFormData(formData))` so period/filter/offset/status are preserved. Rationale: the base contract requires the grid to stay at the same position after a mutation; offerings preserves these. This is a behavior change — update `appointments-create.test.ts` and `appointments-destroy.test.ts` assertions that currently expect `!location.includes('status=')`/no period/filter preservation.

### D4. Context-menu edit uses frame-aware `safeNavigate`
In `app/actions/admin/public/admin-appointments-context-menu.tsx`, replace `window.location.href = ...` in `handleEditAction` (and its catch fallback) with `safeNavigate(baseHref + '?' + params, handle)` imported from `../../../utils/frame-utils.ts`. Delete already uses `form.requestSubmit()` and stays as-is. Rationale: matches the offerings context menu; avoids a full-document navigation (the base contract forbids `window.location.href` for frame-targeted actions). `safeNavigate` is already exported there and used by the offerings menu.

### D5. `IntervalBounds` gates the form end-time selects
Add `<IntervalBounds startId={...} endId={...} />` to the shared `app/ui/admin-appointments-form.tsx`, using the mode-dependent ids already present on the start/end selects (`ae-start`/`ae-end` for edit, `ac-start`/`ac-end` for create). Rationale: mirrors the offerings create/edit forms; makes `end > start` visible client-side instead of surfacing only as a server rejection. `IntervalBounds` is a shared clientEntry at `app/ui/interval-bounds.browser.tsx` used by offerings.

### D6. Add an `Alle` status view
Extend the status tab loop in `app/ui/admin-appointments-page.tsx` from `['pending','expired']` to `['all','pending','expired']` and fix the active-tab self-link so re-clicking a non-default tab keeps its own filter (mirror the offerings `f964bec` change). Add a `status === 'all'` branch to `listAppointments` in `app/data/appointments.ts` (no `a.date` day filter) so it shows past + future, analogous to `listOfferings`. Users on the `all` tab must see the period controls enabled (the current `status === 'expired'` block disables period tabs; `all` should enable them).

### D7. Empty-state CTA
Add an empty-state `Neu anlegen` CTA (frame-targeted `buildCreateUrl`) in `app/ui/admin-appointments-page.tsx` when `rows.length === 0` and no form panel is active, mirroring the offerings empty state.

## Risks / Trade-offs

- [Massive test churn] ~15+ assertions move from 400 to 200 and several `!location.includes('status=')` assertions change. → Mitigation: update the assertions in the same change, keeping them explicit about the new status/state expectations.
- [Grid-state preservation changes existing UX] Users now land back on the same filter/period/status after a mutation instead of a reset grid. → Mitigation: this is the intended base-contract behavior; the `Alle` tab and filter controls remain visible so the user can always reset.
- [Rate-limit re-render now 200] A rate-limited submit becomes a softer 200 inline-error re-render instead of 400. → Mitigation: the message text is unchanged; the frame transport handles it more gracefully. Keep the `process.env.NODE_ENV !== 'test'` guard so tests are unaffected by the limiter.
- [Status `all` duplicates the default 'Alle' period label] The page already labels the default period tab `Alle`. → Mitigation: name the new status tab `Alle` only if unambiguous; otherwise label it `Alle` in the status group (it sits in a separate control group). Confirm labeling during implementation; if confusing, use `Alle` for status and keep the period default label as-is.
- [Half-applied UX parity] Offerings UX items that don't apply (config/week/delete-past) are intentionally omitted, so appointments won't be character-for-character identical. → Mitigation: the specs scope only the applicable subset; the base-contract requirements are the shared contract.

## Migration Plan

1. Controller: convert validation re-renders to 200; replace `errorRedirectDestroy` and the invalid/not-found guards with flash + `appointmentsGridUrl(formData)`; preserve grid state on create/update/delete redirects.
2. Context menu: import `safeNavigate`; replace `window.location.href` with `safeNavigate(...)` for edit.
3. Form: add `IntervalBounds` with mode-dependent ids.
4. Page: add `Alle` status tab + empty-state CTA; adjust `listAppointments` for `status === 'all'`.
5. Tests: update status assertions (400→200), mutation-redirect grid-state assertions, and add base-contract conformance cases (missing-id/not-found/FR-block flash, 200 inline-error).
6. Run `npm test`, `npm run typecheck`, `npm run format:fix`.

Rollback: the controller/context-menu/UI changes are localized; revert the single commit to restore the previous 400/`?error=` behavior. The `listAppointments` `status === 'all'` branch is additive and safe to leave in place.

## Open Questions

- Should the `Alle` status tab default to the neutral view when `status` is unset (so the first load shows `Alle`), or continue defaulting to `Ausstehend` (pending)? This is a UX-defaults choice that doesn't change the spec requirements or the task breakdown; the implementation can pick the non-defaulting option and keep `pending` as the implicit default to avoid changing the default home view. Decide during implementation; record in the task.
