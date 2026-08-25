## Context

See proposal.md - Why. Relevant current-state facts that shape this design:

- The base transport is already shared and in use: `RestfulForm` (PUT/DELETE via `_method` + auto-CSRF), `GridStateHiddenInputs`, `mixins/admin-urls.ts`, `utils/grid-state.ts`, and `parseSafe` → `issuesToFieldErrors`.
- `/verwaltung/offerings` was aligned to the admin-page-base contract by the archived `align-verwaltung-offerings-to-admin-base` change. That work already landed the supporting pieces this change reuses: the verwaltung fragment-path flash banner in `renderVerwaltungPage` reading `session.get('error'|'success')`, frame-aware `safeNavigate` in `utils/frame-utils.ts`, and the per-row action-cell pattern (`table.actionCell`) in the offerings page.
- `/verwaltung/resources` is the closest conforming reference for `/verwaltung/offering-configs`: both are `resources()` route macros with simple create/update/destroy, a `show` GET that resolves a missing row to the grid (not a 404 card), and an agent (`X-Agent-Thread`) JSON create path. The resources controller is the concrete template for the controller-side shape.
- The current `/verwaltung/offering-configs` drifts on the same axes offerings once did: `validateCreate` returns `status: 400/404`; create/update re-render validation failures at 400/404/409; update/destroy return `context.json({ ok: false, error }, { status: 400/404 })` for invalid/missing ids; the destroy constraint-violation re-renders at 400; and `show` GET `/:id` renders a 404 card when the row is missing after a delete.
- The configs page currently has **no visible per-row actions**: edit/delete are reachable only through the right-click context menu backed by a block of hidden bulk DELETE forms, and the context-menu edit does a full `window.location.href`.

## Goals / Non-Goals

**Goals:**
- Bring `/verwaltung/offering-configs` onto the admin-page-base controlled-submission contract: validation failures re-render at 200 with inline errors + preserved values; mutations are Post/Redirect/Get; row actions are server-rendered and frame-targeted.
- Make non-field errors (invalid id, not-found, delete blocked by a constraint) surface via redirect + `session.flash` instead of non-OK JSON or re-renders.
- Add visible per-row actions (edit link + DELETE form) as the primary affordance; keep the right-click context menu as an additional input affordance.
- Make the `show` GET `/:id` resolve a deleted or missing row back to the grid (no 404 card), so the frame's post-delete GET of the deleted row's address does not surface an error.

**Non-Goals:**
- Not changing the `verwaltung` layout, the day/time rule editor (`DayRuleRow`), or the agent (`X-Agent-Thread`) JSON create path — the agent path keeps returning `context.json` validation/created responses by design.
- Not swapping `/verwaltung/offering-configs` into the admin `createSidebarLayout` shell (explicitly deferred, matching the existing admin-page-base design).
- Not removing the context menu affordance — only re-routing its edit through frame-aware navigation and pointing its delete at the visible per-row form.
- Not extracting a shared controller factory; the existing single `loadOfferingConfigPageData` / `renderOfferingConfigPage` pair already fits, mirroring the offerings/resources approach.

## Decisions

### D1. Validation failures re-render at 200 through the existing page-data path
For every create/update validation failure (schema issues, invalid resource, resource not found, duplicate resource, no day enabled, invalid time range), drop the `{ status: validation.status }` / `{ status: 400 }` / `{ status: 404 }` / `{ status: 409 }` re-render overrides and let `renderOfferingConfigPage(context, data)` default to status 200. The `formValues` / `fieldErrors` / `formError` overrides are already wired to render inline errors and preserved values.
- Why: satisfies the base contract (the frame transport treats non-OK as an unrecoverable error card); no new helper is needed because the page-data loader already centralizes the fragment render.
- Alternative rejected: reusing the admin-only render error helper — it is bound to `renderAdminPage` and the admin sidebar, which the `verwaltung` layout does not have.

### D2. Visible per-row actions are server-rendered and frame-targeted
Add a row action cell to the configs table with an edit link and a DELETE form for each row:
- Edit: an anchor with `href` carrying grid-state params + `editing=<id>`, `data-rmx-target={frames.adminContent}`, using `buildEditUrl(...)` from `mixins/admin-urls.ts`.
- Delete: a DELETE `RestfulForm` targeting `routes.verwaltung.offeringConfigs.destroy`, with `data-delete-form=<id>`, `data-confirm`, `data-rmx-target={frames.adminContent}`, `GridStateHiddenInputs` (offset/sort/order/filter), and a submit button.
Because the visible DELETE form now carries `data-delete-form`, the existing hidden bulk DELETE forms at the bottom of the grid are removed (the context menu targets the visible form via `form.requestSubmit()`), avoiding duplicate forms for the same row.
- Why: matches the offerings/resources row-action contract; the context menu delete already looks up `form[data-delete-form]`, so it works against the visible form as-is.
- Alternative rejected: keep only the hidden bulk forms — there would be no visible action affordance, which is the drift being fixed.

### D3. Context menu becomes an input affordance only
In `admin-offering-configs-context-menu.tsx`, replace `window.location.href` in `handleEditAction` with frame-aware `safeNavigate(baseHref + '?' + params, handle)` (imported from `utils/frame-utils.ts`), and keep delete as `form.requestSubmit()` on the row's `data-delete-form` (already present). The grid-state JSON blob already carries the fields the edit params need.
- Why: makes the clientEntry an input affordance only and eliminates the full-document edit navigation, matching the offerings/resources approach.
- Alternative rejected: keep `window.location.href` — it bypasses frame routing and is the remaining client-nav drift.

### D4. Non-field errors use redirect + session.flash (Post/Redirect/Get)
Convert the `context.json({ ok: false, error })` returns in update and destroy (invalid id, not found) and the destroy constraint-violation re-render into a redirect to the grid URL (grid-state preserved via `gridStateFromFormData(formData)` → `gridStateToParams`) plus `context.session.flash('error', message)`. The flash banner added by the offerings alignment already surfaces these in the verwaltung fragment path.
- Why: aligns with the base contract (no non-OK JSON mutation path for the human flow); the toggle precedent in `/admin/users` and the offerings change already use flash for errors with no inline field.
- Alternative rejected: keep the non-OK JSON returns — they trigger the frame's error-card transport and are the drift being fixed.

### D5. GET /:id show redirects to the grid when the row is missing
Change the `show` action so that when `getOfferingConfig(context.db, id)` returns null, the controller redirects (3xx) to the grid index (grid-state from the URL preserved), instead of rendering `{ status: 404 }`. When the row exists, render the edit panel at 200 as today.
- Why: after a delete the frame commits the deleted row's `/:id` as its address and GETs it; redirecting to the grid prevents a 404 card, matching `/verwaltung/resources`.
- Alternative rejected: keep the 404 card — it is the exact fragment error this change eliminates.

### D6. Preserve the agent (X-Agent-Thread) JSON create path
Leave the `X-Agent-Thread` branch of `create` returning `context.json(...)` for `validation_error` / `created` responses and the 409 constraint-violation case. Only the human-flow path changes to 200 re-render / redirect + flash.
- Why: the agent protocol consumes JSON and is a separate, intentional channel; `/verwaltung/resources` keeps the same pattern.
- Alternative rejected: routing the agent path through PRG + flash — it would break the agent's JSON contract.

## Risks / Trade-offs

- [Validation re-renders change from 400 to 200] → Update `app/actions/verwaltung/offering-configs.test.ts` to assert 200 inline-error fragments and preserved values, not 400/404 bodies.
- [JSON error returns become redirects] → The update/destroy not-found and invalid-id tests must assert a 3xx redirect with a flash instead of `response.json()`. This is an admin-only surface; no external contract depends on the JSON bodies.
- [Tightening duplicate/not-found handling on create] → Create-side duplicate/resource-not-found stay as 200 re-renders (form-level banner via `formError`) so the open form keeps its values; this is the same contract the offerings create uses for holiday/past-date/exclusion errors.
- [Hidden bulk DELETE forms removed] → The visible per-row DELETE form carries `data-delete-form`, so both direct clicks and the context menu share one form and `data-confirm` still applies.
- [Context-menu edit now frame-navigates] → `safeNavigate` requires the frame handle; it is the same helper already used by the offerings/resources context menus, so no new risk.

## Migration Plan

1. Controller (`app/actions/verwaltung/offering-configs/controller.tsx`): drop the non-OK status overrides on create/update validation re-renders (make them 200); convert the update/destroy `context.json` error returns and the destroy constraint-violation re-render to redirect + `session.flash`; change the `show` action to redirect to the grid when the row is missing. Leave the `X-Agent-Thread` branch untouched.
2. Page (`app/ui/admin-offering-configs-page.tsx`): add a per-row action cell (edit link via `buildEditUrl` + DELETE `RestfulForm` with `GridStateHiddenInputs` + `data-confirm`); remove the hidden bulk DELETE forms; add the empty-state `Neu anlegen` CTA.
3. Context menu (`app/actions/admin/public/admin-offering-configs-context-menu.tsx`): switch edit to `safeNavigate`; keep delete via `form.requestSubmit()`.
4. Tests: update `app/actions/verwaltung/offering-configs.test.ts` to assert 200 inline-error re-renders, redirect + flash for non-field errors, and the `show` GET redirect for a deleted/missing row. Run `npm test -- offering-configs`, `npm run typecheck`.
5. Verify: `node_modules/.bin/openspec validate align-verwaltung-offering-configs-to-admin-base`.

**Rollback**: The controller status changes are isolated and revertible per action; the page row-action cell and context-menu change are additive (revert to context-menu-only navigation); the empty-state CTA is additive and removable.

## Open Questions

None — the contract mirrors the already-approved offerings/resources alignment, so there are no deferrable unknowns that would change the specs, the approach, or the task breakdown.
