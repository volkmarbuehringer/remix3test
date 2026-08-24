## Context

See proposal.md - Why. Relevant current-state facts that shape this design:

- The base transport is already shared and in use: RestfulForm (PUT/DELETE via _method + auto-CSRF), GridStateHiddenInputs, mixins/admin-urls.ts, utils/grid-state.ts, parseSafe -> issuesToFieldErrors.
- /admin/users is the reference that already conforms: validation failures re-render at 200 inline, row actions are server-rendered forms/links targeting the frame, non-field errors use redirect + session.flash, and there is a shared renderGridFormError helper (admin-layout-specific for renderAdminPage).
- /verwaltung/offerings keeps a dedicated verwaltung layout and renders through renderVerwaltungPage (full-document Layout for non-frame requests, content-only for X-Remix-Target frame requests). The offerings controller already has a single loadOfferingPageData + renderOfferingsPage pair that accepts formValues / fieldErrors / formError overrides and grid overrides.
- Facts driving the fixes: create/update re-render validation failures at 400; update and destroy return context.json(...) for invalid/missing ids; configSave and weekGenerate return JSON 400 on parse errors; weekGenerate, deletePast and configSave redirect with ?error=; the edit context-menu action does a full window.location.href; there are no visible per-row actions (only a right-click menu with hidden bulk DELETE forms).
- Flash visibility constraint: renderVerwaltungPage content-only fragment path has no flash banner, so a session.flash set by a PRG redirect would be consumed but never displayed when the offerings page re-renders as a fragment.

## Goals / Non-Goals

**Goals:**
- Bring /verwaltung/offerings onto the admin-page-base controlled-submission contract: validation failures re-render at 200 with inline errors + preserved values; mutations are Post/Redirect/Get; row actions are server-rendered and frame-targeted.
- Make non-field errors (week-generate, delete-past, config-save, invalid id, not-found) surface via redirect + session.flash instead of ?error= or non-OK JSON.
- Add visible per-row actions (edit link + DELETE form) as the primary affordance; keep the right-click context menu as an additional input affordance.
- Preserve grid-state round-trip (including _period / _status) on every mutation and navigation.

**Non-Goals:**
- Not changing the verwaltung layout or the offerings-specific features (config panel, week-generate panel, delete-past, period/status filters).
- Not swapping /verwaltung/offerings into the admin createSidebarLayout shell (explicitly deferred by the existing admin-page-base design).
- Not removing the context menu affordance - only re-routing it through frame-aware navigation / server forms.
- Not extracting an offerings-specific factory; the existing single loadOfferingPageData / renderOfferingsPage pair already fits.

## Decisions

### D1. Validation failures re-render at 200 through the existing page-data path
The controller already has loadOfferingPageData(context, overrides) + renderOfferingsPage(context, data, init). For every create/update validation failure (schema issues, end<=start, holiday, past date, exclusion constraint), drop { status: 400 } and let renderOfferingsPage default to status 200. The fieldErrors / formError / formValues overrides are already wired to render inline errors and preserved values.
- Why: satisfies the base contract (the frame transport treats non-OK as an unrecoverable error card); no new helper or factory is needed because the page-data loader already centralizes the fragment render.
- Alternative rejected: reusing the admin-only renderGridFormError directly - it is bound to renderAdminPage and the admin activeItem (sidebar highlight), which the verwaltung layout does not have. Per-page handling via the existing loader is lower-ceremony here.

### D2. Visible per-row actions are server-rendered and frame-targeted
Add a row action cell to the offerings table with an edit link and a DELETE form for each row:
- Edit: an anchor with href carrying grid-state params (including period/status) plus editing=<id>, with data-rmx-target=admin-content.
- Delete: a DELETE RestfulForm targeting routes.verwaltung.offerings.destroy, with data-delete-form=<id>, data-confirm, data-rmx-target=admin-content, containing GridStateHiddenInputs (offset/sort/order/filter/period/status) and a submit button.
Because the visible DELETE form now carries data-delete-form, the existing hidden bulk DELETE forms at the bottom of the grid are removed (the context menu targets the visible form via form.requestSubmit()), avoiding duplicate forms for the same row.

### D3. Context menu becomes an input affordance only
In admin-offerings-context-menu.tsx, replace window.location.href (edit) with frame-aware safeNavigate(baseHref + '?' + params, handle) - the same helper /admin/users uses - and keep delete as form.requestSubmit() on the row's data-delete-form. The grid-state JSON blob already carries period/status for the offerings page, so the edit params include them.
- Why: makes the clientEntry an input affordance only and eliminates the full-document edit navigation, matching the base contract and /admin/users.
- Alternative rejected: keep window.location.href - it bypasses frame routing and is the remaining client-nav drift.

### D4. Non-field errors use redirect + session.flash (Post/Redirect/Get)
For weekGenerate, deletePast, and configSave, replace the ?error= query param with context.session.flash('error'|'success', message) then redirect(gridListUrl(gridStateFromFormData(formData))) - always preserving grid state. Convert the context.json(...) error returns in update (invalid id), destroy (not found/invalid id), and configSave/weekGenerate parse failures to the same redirect + flash pattern.
- Why: aligns with the base contract (no non-OK JSON mutation path, no query-param error channel); the toggle precedent in /admin/users already uses flash for errors with no inline field.
- Why redirect on config-save parse failure too: config-save is a panel action with no per-field error surface that maps onto the grid; flash is the correct coarse surface, and it avoids the JSON-400 error card.

### D5. Surface flash in the verwaltung fragment path
Add a flash (error + success) banner to renderVerwaltungPage's content-only fragment path (when X-Remix-Target is a frame target), reading session.get('error'|'success') exactly like app/ui/layout.tsx. The full-document path already shows flash through the main Layout.
- Why: the offerings mutations target admin-content; when the response is a content-only fragment, the main Layout does not render, so without this banner PRG flash messages would be silently consumed.
- Alternative rejected: re-render the grid fragment at 200 with an inline error banner from the controller - inconsistent with the flash convention and duplicates surfacing.
- Open question: whether the offerings page is ever actually frame-rendered in production (its internal links use data-rmx-target but the verwaltung shell has no admin-content frame). Adding the banner is harmless either way; see Open Questions.

## Risks / Trade-offs

- [Flash invisible in the fragment path] -> Mitigated by D5; if the offerings page is effectively full-document-only, the main Layout banner already covers it, so D5 is a no-risk extra.
- [Context-menu delete now targets the visible form] -> form?.requestSubmit() guard; the form is rendered on every row, so the menu action stays functional.
- [Moving off ?error= changes URL/redirect behavior] -> Admin-only surface; update the offerings tests to assert redirect + flash instead of ?error= query params.
- [Config-save success previously dropped grid state] -> Now preserved via gridStateFromFormData, which is the intended behavior and matches the grid-state requirement.
- [Removing hidden bulk DELETE forms] -> The visible DELETE form carries data-delete-form, so both direct clicks and the context menu share one form; confirm before submit still applies via data-confirm.

## Migration Plan

1. Controller (app/actions/verwaltung/offerings/controller.tsx): drop { status: 400 } re-renders (create/update validation); convert context.json + ?error= paths to redirect + session.flash; preserve grid state on configSave; update the audit/error flows.
2. Page (app/ui/admin-offerings-page.tsx): add a row action cell (edit link + DELETE RestfulForm with GridStateHiddenInputs + data-confirm), remove the hidden bulk DELETE forms, and ensure the grid-state JSON blob carries period/status.
3. Context menu (app/actions/admin/public/admin-offerings-context-menu.tsx): switch edit to safeNavigate; keep delete via form.requestSubmit() on the row's data-delete-form.
4. Flash surfacing (app/ui/verwaltung-layout.tsx): add a fragment-path flash banner reading session error/success.
5. Tests: update app/actions/verwaltung/offerings-index.test.ts and any offerings create/update/destroy/config/week tests to assert 200 inline-error fragments and redirect + flash, not 400 / ?error= / JSON bodies. Run npm test -- offerings, npm run typecheck, and openspec validate align-verwaltung-offerings-to-admin-base.

**Rollback**: The controller status changes are isolated and revertible per action; the page row-action cell and context-menu change are additive (revert to context-menu-only navigation); the flash banner is additive and removable.

## Open Questions

- Whether the /verwaltung/offerings page is ever served as a frame fragment in practice (its internal links use data-rmx-target=admin-content, but the verwaltung shell does not render an admin-content frame). This only affects whether D5 is strictly required or merely harmless; it does not change the specs, the chosen approach, or the task breakdown, so it can be confirmed during implementation.
