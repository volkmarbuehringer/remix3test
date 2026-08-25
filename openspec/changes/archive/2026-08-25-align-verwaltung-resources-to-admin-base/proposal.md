## Why

`/verwaltung/offerings` was aligned to the shared admin page/form base contract (commit `d8ae5f1`) and then hardened and improved (`f6df510`, `f964bec`), and `/verwaltung/appointments` was aligned the same way (`6395278`): validation failures re-render as **200** inline-error fragments (not 400), non-field errors surface via `session.flash` + Post/Redirect/Get (not JSON/`?error=`), row actions are server-rendered frame-targeted forms, the frame-aware context-menu edit uses `safeNavigate` (not `window.location.href`), grid state round-trips on every mutation, and the deleted-row GET `/api/:id` resolves back to the grid instead of a 404 card. `/verwaltung/resources` still drifts from that state, so its mutations behave differently from the canonical base contract and from its sibling pages.

## What Changes

Port the `/verwaltung/offerings` codestate to `/verwaltung/resources` while keeping the resources-specific features (name/description/capabilities fields, min-length validation, and the Bearer/agent JSON create path used by the resource-capability agent).

- **Validation re-render becomes 200, not 400**: create/update failures re-render the targeted frame at status 200 carrying `formValues` + `fieldErrors`, so the frame shows inline errors and preserved values instead of the frame transport's non-OK error card. This covers schema failures (short name, short description, over-long capabilities).
- **Non-field errors switch to `session.flash` + Post/Redirect/Get**: update/destroy invalid-id and not-found guards and the destroy foreign-key violation stop using `context.json` 400/404/`formError` re-renders. They redirect back to the grid and surface the message via flash, preserving grid state in the redirect.
- **Grid state round-trips on every mutation**: `_offset/_sort/_order/_filter` are carried on create, update, and delete redirects so the grid stays at the same position after any PRG. Create's success redirect keeps `editing=<id>` so the created row stays in view.
- **GET `/:id` resolves a deleted/missing row to the grid**: the `show` route renders the inline edit panel when the row exists and PRGs to the grid when it has been deleted or does not exist, so the frame's GET of the committed `/:id` action path after a delete no longer shows a 404 "Eintrag nicht gefunden." card.
- **Row actions become server-rendered and frame-targeted**: add the visible per-row edit link and DELETE form (`data-rmx-target={frames.adminContent}`) next to the existing context-menu affordance; the DELETE/update/create forms that currently lack `data-rmx-target` get it so they navigate only the content frame.
- **Context-menu edit becomes frame-aware**: right-click edit navigates via `safeNavigate` instead of `window.location.href`; delete already submits the server-rendered DELETE form via `form.requestSubmit()`.
- **UX parity (applicable subset)**: add an empty-state `Neu anlegen` CTA when no rows and no form panel are active. Offerings/appointments-only features (per-row config, week-generate, delete-past, period/status filters, `IntervalBounds` end-time gating) are intentionally not ported — resources have no config/week/delete-past flows and no start/end times.

## Capabilities

### New Capabilities
- `verwaltung-resources-admin-base`: the `/verwaltung/resources` CRUD page conforms to the shared admin page/form base contract — server-rendered frame-targeted row actions, Post/Redirect/Get mutations, validation failures re-rendered as a 200 inline-error fragment, non-field errors surfaced via redirect + `session.flash`, and grid-state round-trip on every mutation — while keeping the existing `verwaltung` layout and the resources-specific fields (name/description/capabilities) and agent JSON create path.

### Modified Capabilities
- `resources-form-validation`: the create/update validation-failure re-render changes from **status 400** to **status 200** (inline errors and preserved values still required), and the non-field error paths (invalid/not-found id, foreign-key delete block) move from `context.json`/400-`formError` to redirect + `session.flash`. This aligns the resources page with the `admin-page-base` controlled-submission contract.

## Impact

- **Code**: `app/actions/verwaltung/resources/controller.tsx` (drop `{ status: 400 }` re-renders in favour of 200; convert invalid-id/not-found/FK-block non-field errors to `session.flash` + PRG via a `resourcesGridUrl(formData)` helper; preserve grid state on create/update/delete redirects; make `show` PRG to the grid for a missing row), `app/ui/admin-resources-page.tsx` (add visible per-row edit/delete row actions with `data-rmx-target`, add `data-rmx-target` to the create/edit forms, add the empty-state `Neu anlegen` CTA), `app/actions/admin/public/admin-resources-context-menu.tsx` (frame-aware edit via `safeNavigate`).
- **Contract/API**: the frame-targeted resources mutations become PRG + flash instead of 400 re-renders and JSON 400/404; mutation redirects preserve grid state; the agent-`X-Agent-Thread` JSON create path is unchanged.
- **Systems**: no new dependencies; relies on the shared `RestfulForm`, `GridStateHiddenInputs`, `grid-state.ts`, `safeNavigate`, and the frame transport already used by `/verwaltung/offerings`, `/verwaltung/appointments`, and `/admin/users`.
- **Tests**: update `app/actions/verwaltung/resources.test.ts` to assert 200 inline-error fragments (not 400), PRG + `session.flash` for non-field errors and the FK delete block, preserved grid state on mutation redirects, and that GET `/verwaltung/resources/:id` for a deleted row redirects to the grid (not 404).
