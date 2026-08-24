## Why

`/admin/users` now embodies the canonical admin page/form base: server-rendered row actions, Post/Redirect/Get mutations, server-side validation re-rendered as a **200** inline-error fragment, non-field errors surfaced via `session.flash`, and grid-state round-trip. `/verwaltung/offerings` still drifts from that state — it re-renders validation failures as **400**, returns JSON errors via `context.json`, passes messages through `?error=` query params, navigates edit through `window.location.href`, and has no visible per-row actions. This change brings `/verwaltung/offerings` onto the same base contract while preserving its dedicated `verwaltung` layout and its offerings-specific features (config, week-generate, delete-past, period/status filters).

## What Changes

- **Validation re-render becomes 200, not 400**: create/update failures re-render the targeted fragment at status 200 carrying `formValues` + `fieldErrors`/`formError`, so the frame shows inline errors and preserved values instead of the frame transport's non-OK error card.
- **Server-rendered row actions**: each offering row gains visible, server-rendered actions — an edit link and a DELETE form — both targeting the frame (`data-rmx-target={frames.adminContent}`) with grid-state hidden inputs and delete confirmation. No client-side data mutation, no `fetch`, no `frame.reload()`.
- **Context menu becomes an input affordance only**: right-click edit navigates via frame-aware `safeNavigate` (not `window.location.href`), and delete submits the existing server render form via `form.requestSubmit()`.
- **Non-field errors switch to `session.flash` + Post/Redirect/Get**: week-generate, delete-past, and config-save results (and invalid-id / not-found guards) stop using `?error=` query params and `context.json` non-OK returns; they redirect back to the grid and surface via flash.
- **Grid-state round-trip preserved**: `_offset/_sort/_order/_filter` (plus `_period`/`_status`) are carried on every mutation and navigation so the grid stays at the same position after any PRG or re-render.

## Capabilities

### New Capabilities
- `verwaltung-offerings-admin-base`: the `/verwaltung/offerings` CRUD page conforms to the shared admin page/form base contract — server-rendered row actions targeting the frame, Post/Redirect/Get mutations, validation failures re-rendered as a 200 inline-error fragment, non-field errors surfaced via redirect + `session.flash`, and grid-state round-trip — while keeping the existing `verwaltung` layout and the offerings-specific features.

### Modified Capabilities
- `admin-offerings-form-validation`: the create/update validation-failure re-render changes from **status 400** to **status 200** (inline errors and preserved values still required), aligning the offerings page with the `admin-page-base` controlled-submission contract.

## Impact

- **Code**: `app/actions/verwaltung/offerings/controller.tsx` (drop `{ status: 400 }` re-renders; convert `context.json` error returns and `?error=` messages to flash + redirect), `app/ui/admin-offerings-page.tsx` (visible per-row edit link + DELETE form), `app/actions/admin/public/admin-offerings-context-menu.tsx` (frame-aware edit via `safeNavigate`; delete already `requestSubmit`), and flash surfacing so PRG messages are visible in verwaltung fragment renders.
- **Contract/API**: the frame-targeted offerings mutations become PRG + flash instead of 400 re-renders and `?error=` navigations; no JSON-returning mutation path remains.
- **Systems**: no new dependencies; relies on the shared `RestfulForm`, `GridStateHiddenInputs`, `grid-state.ts`, and `safeNavigate` helpers already in use by `/admin/users`.
- **Tests**: update `app/actions/verwaltung/offerings-index.test.ts` and any offerings mutation tests to assert a 200 inline-error fragment (not 400) and PRG + flash for non-field errors.
