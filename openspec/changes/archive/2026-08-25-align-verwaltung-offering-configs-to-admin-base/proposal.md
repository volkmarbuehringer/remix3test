## Why

`/verwaltung/offerings` (and `/verwaltung/resources`) now conform to the shared admin page/form base contract: validation failures re-render as a **200** inline-error fragment, mutations are Post/Redirect/Get, non-field errors surface via `session.flash`, row actions are server-rendered and frame-targeted, and grid state round-trips on every mutation. `/verwaltung/offering-configs` still drifts from that state — it re-renders validation failures as **400/404/409**, returns JSON errors via `context.json`, renders a **404** card for a deleted/missing rows on GET `/:id`, and has no visible per-row actions. This change brings `/verwaltung/offering-configs` onto the same admin-page-base contract while preserving its dedicated `verwaltung` layout, the day/time rule editor, and the agent (`X-Agent-Thread`) JSON create path.

## What Changes

- **Validation re-render becomes 200, not 400/404/409**: create/update failures re-render the targeted fragment at status 200 carrying `formValues` + `fieldErrors`/`formError`, so the frame shows inline errors and preserved values instead of the frame transport's non-OK error card.
- **Non-field errors switch to `session.flash` + Post/Redirect/Get**: invalid-id / not-found guards in update and destroy stop returning `context.json({ ok: false, error })` non-OK bodies; a destroy blocked by a constraint stops re-rendering as a 400; they redirect back to the grid and surface via flash.
- **GET `/:id` resolves a deleted or missing row to the grid**: the `show` GET stops rendering a **404 "Eintrag nicht gefunden."** card after a delete (the frame commits the deleted row's `/:id` as its address and GETs it after the mutation); it redirects back to the grid like `/verwaltung/resources`.
- **Server-rendered row actions**: each offering-config row gains visible, server-rendered actions — an edit link and a DELETE `RestfulForm` — both targeting the frame (`data-rmx-target={frames.adminContent}`) with grid-state hidden inputs and delete confirmation. The hidden bulk DELETE forms are removed so the context menu targets the visible per-row form.
- **Empty grid offers an explicit create entry point**: the empty state renders a frame-targeted `Neu anlegen` CTA when no form panel is active.
- **Context menu becomes an input affordance only**: right-click edit navigates via frame-aware `safeNavigate` (not `window.location.href`); delete keeps submitting the existing server-rendered form via `form.requestSubmit()`.
- **Grid-state round-trip preserved**: `_offset/_sort/_order/_filter` are carried on every mutation and navigation so the grid stays at the same position after any PRG or re-render.

## Capabilities

### New Capabilities
- `verwaltung-offering-configs-admin-base`: the `/verwaltung/offering-configs` CRUD page conforms to the shared admin page/form base contract — server-rendered frame-targeted row actions, Post/Redirect/Get mutations, validation failures re-rendered as a 200 inline-error fragment, non-field errors surfaced via redirect + `session.flash`, grid-state round-trip, and an empty-state create CTA — while keeping the existing `verwaltung` layout, the day/time rule editor, and the agent JSON create path.

### Modified Capabilities
- `offering-configs-form-validation`: the create/update validation-failure re-render changes from **status 400** to **status 200** (inline errors and preserved values still required), aligning the offering-configs page with the admin-page-base controlled-submission contract.

## Impact

- **Code**: `app/actions/verwaltung/offering-configs/controller.tsx` (make create/update validation re-renders return 200; convert `context.json` error returns and the destroy constraint-violation re-render to flash + redirect; make `show` redirect to the grid for a missing row), `app/ui/admin-offering-configs-page.tsx` (visible per-row edit link + DELETE form; remove hidden bulk DELETE forms; add an empty-state create CTA), `app/actions/admin/public/admin-offering-configs-context-menu.tsx` (frame-aware edit via `safeNavigate`).
- **Contract/API**: the frame-targeted offering-configs mutations become PRG + flash instead of non-OK re-renders and JSON error bodies; no JSON-returning mutation path remains for the human flow. The agent (`X-Agent-Thread`) JSON create path is preserved unchanged.
- **Systems**: no new dependencies; reuses the shared `RestfulForm`, `GridStateHiddenInputs`, `grid-state.ts`, `safeNavigate`, and the verwaltung fragment flash banner already in place from the offerings alignment.
- **Tests**: update `app/actions/verwaltung/offering-configs.test.ts` to assert 200 inline-error re-renders (not 400/404), redirect + flash for non-field errors (not JSON 404 bodies), and the `show` GET redirect for a deleted/missing row.
