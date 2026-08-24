## Why

Every admin page currently hand-rolls the same transport — the shared `entry.tsx` frame runtime, server-rendered controller + page pair, `data-rmx-target` navigation, and server-side "controlled submission" — but with drift. `/admin/users` is the closest to an ideal base (server-rendered rows, grid-state preservation, `parseSafe` → inline `fieldErrors`), yet it still carries client-mutating features (the toggle + context-menu go through a JSON `fetch` and `frame.reload()`) and other pages diverge from it. We want one canonical, UX-friendly base: server-driven actions, Post/Redirect/Get, no client-side data mutation, so every page/form converges instead of re-deriving the pattern.

The app is SSR-first by default with thin, additive client code, so a single shared client runtime (`app/assets/entry.tsx`) is loaded on every page. The base contract must preserve that stance: server rendering is the baseline, and client augmentation is only layered on where it genuinely improves UX.

## What Changes

- **SSR-first baseline with thin client**: pages render on the server by default; client code is minimal and additive. The shared client runtime (`app/assets/entry.tsx`) is loaded on every page; removing client enhancement must still yield a fully usable, server-rendered page. No page may rely on client-side rendering for its content.
- **Establish a canonical admin page/form base** built on the existing shared transport: `app/assets/entry.tsx` frame runtime + `createController` action + server-rendered page component, navigated via `data-rmx-target={frames.adminContent}`.
- **Controlled submission contract**: mutations validate server-side; on validation failure the controller re-renders the same frame fragment at **status 200** with `fieldErrors` + preserved `formValues`; on success it **redirects (PRG)** preserving grid-state. Non-OK re-renders aren't allowed (the frame transport treats them as an unrecoverable error card, which is the "POST → 400 → Frame re-fetches the POST URL → GET 404" trap).
- **Row actions are server-rendered forms**, never a client-mutating path: each per-row action is a `<form method="POST|PUT|DELETE" ... data-rmx-target>` (PUT/DELETE via `_method` override through `RestfulForm`) or an `<a data-rmx-target>` link — **no `fetch` mutation, no `frame.reload()` after a mutation**.
- **clientEntry is an input affordance only**: it may enhance UX (delete confirm, right-click menu) but must trigger an existing server form (e.g. `form.requestSubmit()`) — it SHALL NOT be a data-mutation endpoint.
- **Toggle (disable/enable) moves off the JSON endpoint**: `POST /admin/users/:id/toggle-disabled` becomes a plain server-rendered `<form method="POST" data-rmx-target>` (no `_method` override needed — the route is already POST). Success → PRG back to the grid.
- **Toggle/actions without an inline error field** surface errors via **redirect + `session.flash`** (soft-fork), not a 200 re-render with `fieldErrors`.
- **Grid-state round-trip** (`_offset/_sort/_order/_filter`) preserved via `GridStateHiddenInputs` on every form and centralized URL builders in `mixins/admin-urls.ts`.
- **Reference scaffold**: the base is captured as a copyable controller + page pair that new admin pages follow, rather than each page re-deriving the pattern.

## Capabilities

### New Capabilities
- `admin-page-base`: the contract for the standard admin page/form base — SSR-first rendering with thin client augmentation, frame + controlled submission, server-rendered row actions with PRG, grid-state preservation, and clientEntry restricted to input affordances (never a data-mutation path).

### Modified Capabilities
<!-- Existing specs whose REQUIREMENTS change. Aligns with: nutzer-context-menu,
     nutzer-form-render-validation, nutzer-status-filter, parse-safe-consistency,
     frame-navigation-conventions, controller-feature-colocation. None are changed
     at the spec level here — this change introduces the base contract that the
     per-page specs consolidate onto. -->
- (none yet — consolidate existing per-page specs onto `admin-page-base` in a follow-up)

## Impact

- **Code**: `app/actions/admin/users/controller.tsx` (toggle action → PRG from a server form; drop the JSON-mutation return), `app/actions/admin/public/admin-users-context-menu.tsx` (menu activate/deactivate submits the server toggle form instead of `fetch`), `app/ui/admin-users-page.tsx` (row toggle button → `RestfulForm`), shared helpers already in place (`app/ui/mixins/admin-urls.ts`, `app/ui/grid-state-hidden.tsx`, `app/utils/grid-state.ts`, `app/ui/restful-form.tsx`).
- **Contract/API**: removes the JSON-returning `toggle-disabled` usage; the endpoint becomes PRG. Any admin CRUD page adopting the base conforms to the same transport.
- **Systems**: no new dependencies; relies on the existing Pinna `remix/ui` frame runtime, `createSidebarLayout`, and `parseSafe`/`issuesToFieldErrors` helpers.
- **Tests**: adjust `app/actions/admin/admin-users.test.ts` (toggle now a PRG form round-trip instead of JSON) and add base-contract coverage.
