## Why

`/verwaltung/offerings` was aligned to the shared admin page/form base contract (commit `d8ae5f1`) and then hardened and improved (`f6df510`, `f964bec`): validation failures re-render as **200** inline-error fragments (not 400), non-field errors surface via `session.flash` + Post/Redirect/Get (not `?error=`/JSON), row actions are server-rendered frame-targeted forms, the frame-aware context-menu edit uses `safeNavigate` (not `window.location.href`), grid state round-trips on every mutation, and the create/end-time selects are gated via `IntervalBounds`. `/verwaltung/appointments` only received a partial port (row actions, ConfirmDelete, fragment flash) and still drifts from that state, so its mutations behave differently from the canonical base contract.

## What Changes

Port the `/verwaltung/offerings` codestate to `/verwaltung/appointments` while keeping the appointments-specific features (per-user field, booking-slot validation via `isSlotBookable`, SSE `invalidate` broadcast, per-user rate limiting).

- **Validation re-render becomes 200, not 400**: create/update failures re-render the targeted frame at status 200 carrying `formValues` + `fieldErrors`/`formError`, so the frame shows inline errors and preserved values instead of the frame transport's non-OK error card. This covers schema failures, missing/invalid resource or user, `end <= start`, past-date, slot-not-bookable, exclusion overlap, and rate-limit paths.
- **Non-field errors switch to `session.flash` + Post/Redirect/Get**: update/destroy invalid-id and not-found guards, the destroy foreign-key violation, and the create/update non-OK guards stop using `?error=` redirects and 400-with-`formError` re-renders. They redirect back to the grid and surface the message via flash.
- **Grid state round-trips on every mutation**: `_offset/_sort/_order/_filter` plus `_period/_status` are carried on create, update, and delete redirects so the grid stays at the same position after any PRG. This replaces the current behavior that **strips** period/filter/offset/status after a mutation (existing tests asserting `!location.includes('status=')` are updated).
- **Context-menu edit becomes frame-aware**: right-click edit navigates via `safeNavigate` instead of `window.location.href`; delete already submits the server-rendered DELETE form via `form.requestSubmit()`.
- **UX parity (applicable subset)**: add the `IntervalBounds` clientEntry to the shared appointment form so end-time options are gated to be `>` the selected start; add an `Alle` status tab alongside `Ausstehend`/`Abgelaufen` (fixing the active-tab self-link so re-clicking a non-default tab keeps its own filter); add an empty-state `Neu anlegen` CTA. Offerings-only features (per-row config, week-generate, delete-past, KW/WD column collapse) are intentionally not ported.

## Capabilities

### New Capabilities
- `verwaltung-appointments-admin-base`: the `/verwaltung/appointments` CRUD page conforms to the shared admin page/form base contract — server-rendered frame-targeted row actions, Post/Redirect/Get mutations, validation failures re-rendered as a 200 inline-error fragment, non-field errors surfaced via redirect + `session.flash`, and grid-state round-trip on every mutation — while keeping the existing `verwaltung` layout and the appointments-specific features (user field, slot validation, SSE `invalidate`, rate limiting).

### Modified Capabilities
- `admin-appointments-form-validation`: the create/update validation-failure re-render changes from **status 400** to **status 200** (inline errors and preserved values still required), and the non-field error paths (invalid/not-found id, foreign-key delete block) move from `?error=`/400-`formError` to redirect + `session.flash`. This aligns the appointments page with the `admin-page-base` controlled-submission contract.

## Impact

- **Code**: `app/actions/verwaltung/appointments/controller.tsx` (drop `{ status: 400 }` re-renders in favour of 200; convert `errorRedirectDestroy`/400-`formError` non-field errors to `session.flash` + PRG; preserve grid state on create/update/delete redirects), `app/ui/admin-appointments-form.tsx` (add `IntervalBounds` with mode-dependent start/end ids per the existing `ac-*`/`ae-*` ids), `app/ui/admin-appointments-page.tsx` (add `Alle` status tab, empty-state `Neu anlegen` CTA, thread past grid state), `app/actions/admin/public/admin-appointments-context-menu.tsx` (frame-aware edit via `safeNavigate`).
- **Contract/API**: the frame-targeted appointments mutations become PRG + flash instead of 400 re-renders and `?error=` navigations; mutation redirects preserve grid state; no JSON-returning mutation path remains.
- **Systems**: no new dependencies; relies on the shared `RestfulForm`, `GridStateHiddenInputs`, `grid-state.ts`, `safeNavigate`, and `IntervalBounds` helpers already used by `/verwaltung/offerings` and `/admin/users`.
- **Tests**: update `app/actions/verwaltung/appointments-create.test.ts`, `appointments-update.test.ts`, `appointments-destroy.test.ts`, and `appointments-index.test.ts` to assert 200 inline-error fragments (not 400), PRG + `session.flash` for non-field errors, and preserved `status`/grid state on mutation redirects.
