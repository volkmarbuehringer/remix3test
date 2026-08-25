## Context

See `proposal.md` — Why. `/verwaltung/resources` already has the shared `verwaltung` fragment flash banner (`renderVerwaltungPage` in `app/ui/verwaltung-layout.tsx`), a hidden DELETE form + context menu, `ConfirmDelete`, `GridStateHiddenInputs`, and grid state round-trip on create/update via `gridStateFromForm(parsed)`. What remains is bringing the mutation transport onto the base contract (200 inline-error re-renders, `session.flash` PRG for non-field errors), making the `show` route resolve a deleted row to the grid, exposing server-rendered frame-targeted row actions, making the context-menu edit frame-aware, frame-targeting the create/edit forms, and adding the empty-state CTA. The requirements live in `specs/verwaltung-resources-admin-base/spec.md` and the `specs/resources-form-validation/spec.md` delta.

## Goals / Non-Goals

Goals
- Bring `/verwaltung/resources` mutations onto the same base contract as `/verwaltung/offerings`/`/verwaltung/appointments`/`/admin/users`: 200 inline-error re-renders, `session.flash` PRG for non-field errors, grid-state round-trip.
- Make the resources context menu edit frame-aware (`safeNavigate`) instead of `window.location.href`, and expose visible server-rendered row actions (edit link + DELETE form) alongside the context menu.
- Keep the resources-specific features intact: name/description/capabilities fields, min-length validation, and the agent `X-Agent-Thread` JSON create path.

Non-Goals
- Do NOT port offerings/appointments-only features: per-row config action, week-generate, delete-past, period/status filters, an `Alle` status tab, `IntervalBounds` end-time gating, `countPastOfferings`/`deletePastOfferings`.
- Do NOT change the name (≥4) or description (≥8) validation rules — only the response status/transport they use.
- Do NOT change the agent `X-Agent-Thread` JSON create surface (the resource-capability agent path) — the base-contract conformance applies to the frame-targeted (non-agent) mutation path.

## Decisions

### D1. Validation failures re-render at 200, not 400
Drop `{ status: 400 }` on the `renderResourcePage(...)` calls in `create` and `update` (schema failure: short name, short description, over-long capabilities) so they render as 200. Rationale: the shared frame transport treats a non-OK fragment as an unrecoverable error card; the base contract (and `verwaltung-offerings-admin-base`) requires an OK inline-error fragment. Alternative considered: keep 400 and special-case the frame — rejected because it diverges from the established contract and the offerings/appointments behavior. This requires updating `assert.equal(response.status, 400, ...)` assertions in `resources.test.ts` to 200.

### D2. Non-field errors move to `session.flash` + PRG
Add a `resourcesGridUrl(formData)` helper (mirroring `offeringsGridUrl`/`appointmentsGridUrl`) that builds the grid index URL from `gridStateToParams(gridStateFromFormData(formData))`. Replace the `context.json({ ok: false, ... }, { status: 400 })` invalid-id guard, the `context.json({ ok: false, ... }, { status: 404 })` not-found guard in `update`/`destroy`, and the 400-with-`formError` destroy FK-constraint re-render with `context.session.flash('error', msg)` + `redirect(resourcesGridUrl(formData))`. Rationale: the base contract forbids non-OK JSON responses and `?error=` for frame-targeted mutations; flash surfaces through the shared `verwaltung` banner. Keep the page-level `formError` banner only for the (now-unused) form-panel path; the FK and missing-row messages move to flash.

### D3. Grid state round-trips on create/update/delete redirects
Standardise the success redirects on `gridStateToParams(gridStateFromFormData(formData))` (keeping `editing=<id>` on create). The current code already preserves `_offset/_sort/_order/_filter` via `gridStateFromForm(parsed)`, so this is a consolidation to the canonical helper rather than a behavior fix; it also makes the delete success and create/update redirects read the same source so the grid stays at the same position after any PRG. Rationale: the base contract requires the grid to remain at the same offset/sort/filter after a mutation; `gridStateFromFormData(formData)` is the same helper the offerings/appointments controllers use. Resources have no `_period`/`_status`, so those are omitted.

### D4. Show a deleted/missing row redirects to the grid
In the `show` action, when `db.findOne(resources, { where: { id } })` returns null (or the id is invalid), `redirect(routes.verwaltung.resources.index.href())` instead of `renderResourcePage(context, data, { status: 404 })`. Rationale: the frame commits the form action path (`/:id`) as its src and GETs it after a PUT/DELETE; after a delete the row is gone, so rendering the 404 "Eintrag nicht gefunden." card is unrecoverable. This matches the appointments `show` behaviour.

### D5. Row actions become server-rendered and frame-targeted
Add an action cell to the resources table (a `<td mix={table.actionCell}>` with a `buildEditUrl` edit link and a `RestfulForm method="DELETE"` per row), both carrying `data-rmx-target={frames.adminContent}`, mirroring `admin-offerings-page.tsx`/`admin-appointments-page.tsx`. Keep the hidden DELETE forms and context menu but also add `data-rmx-target={frames.adminContent}` to them so context-menu delete targets the frame. Add `data-rmx-target={frames.adminContent}` to the create/edit `RestfulForm` panels (currently bare). Rationale: the base contract requires each row action to be a server-rendered form/link navigating only the content frame; the current page relies on the context menu alone and the forms don't declare a frame target.

### D6. Context-menu edit uses frame-aware `safeNavigate`
In `app/actions/admin/public/admin-resources-context-menu.tsx`, import `safeNavigate` from `../../../utils/frame-utils.ts` and replace both `window.location.href = ...` uses in `handleEditAction` (and its catch fallback) with `safeNavigate(<href>, handle)`. Delete already uses `form.requestSubmit()` and stays as-is. Rationale: matches the offerings/appointments menus; avoids a full-document navigation (the base contract forbids `window.location.href` for frame-targeted actions).

### D7. Empty-state CTA
Add an empty-state `Neu anlegen` CTA (frame-targeted `buildCreateUrl`) when `rows.length === 0` and no form panel is active (`!hasFormPanel`, where `hasFormPanel = Boolean(editRow || creating)`), mirroring the offerings/appointments empty state. Rationale: an empty list should not be a dead end, and the base contract wants server-rendered frame-targeted navigation.

## Risks / Trade-offs

- [Test churn] Several `resources.test.ts` assertions move from 400 to 200, the DELETE-404 assertion becomes a 302 + flash redirect, and new conformance cases (missing-id/not-found/FK-block flash, GET `/:id` redirect, grid-state preservation) are added. → Mitigation: update the assertions in the same change and keep them explicit about the new status/state expectations.
- [Agent JSON create path untouched] The `X-Agent-Thread` path keeps returning 400 JSON on a bad payload and `{ status: 'created' }` on success, while the frame path becomes 200/PRG. → Mitigation: this is an intentional two-surface design (JSON API for the agent vs. frame transport for the admin); scoped out of the base-contract conformance and covered by its own test.
- [Visibility change] Rows gain visible edit/delete buttons alongside the context menu. → Mitigation: additive; the existing context menu stays, and the buttons reuse the same `buildEditUrl`/`GridStateHiddenInputs` helpers already validated on offerings/appointments.
- [Page-level `formError` becomes dead] After moving the FK-block to flash, the resources page's page-level `formError` banner has no remaining producer. → Mitigation: gate it behind `!hasFormPanel` (matching the appointments pattern) so it does not double-render if a future form-panel path sets it; no behavior change for the current paths.

## Migration Plan

1. Controller (`app/actions/verwaltung/resources/controller.tsx`): convert create/update validation re-renders to 200; add `resourcesGridUrl(formData)`; convert update/destroy invalid-id/not-found guards and the destroy FK-block to flash + PRG; standardise create/update/delete redirects on `gridStateFromFormData(formData)`; make `show` PRG to the grid for a missing row.
2. Page (`app/ui/admin-resources-page.tsx`): add the visible action cell (edit link + DELETE form with `data-rmx-target`), add `data-rmx-target` to the create/edit forms and the hidden DELETE forms, add the empty-state `Neu anlegen` CTA gated on `!hasFormPanel`.
3. Context menu (`app/actions/admin/public/admin-resources-context-menu.tsx`): import `safeNavigate`; replace `window.location.href` with `safeNavigate(...)` for edit.
4. Tests (`app/actions/verwaltung/resources.test.ts`): update status assertions (400→200), the DELETE-404→302+flash, add the FK-block/not-found flash cases, the GET `/:id` redirect case, and grid-state preservation.
5. Run `npm test`, `npm run typecheck`, `npm run format:fix`.

Rollback: the controller/context-menu/UI changes are localized; revert the single commit to restore the previous 400/JSON/`window.location.href` behavior. The agent JSON path is untouched.

## Open Questions

None. Resources have no period/status filters and no end-time selects, so the offerings/appointments UX parity questions (`Alle` tab default, `IntervalBounds` ids) do not apply; the applicable subset (empty-state CTA, frame-aware row actions, 200 inline-error re-render, flash PRG, GET `/:id` redirect) is fully specified above.
