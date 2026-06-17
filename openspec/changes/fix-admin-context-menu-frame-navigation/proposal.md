## Why

All seven admin context menu implementations silently break after any Frame-targeted navigation (sort, paginate, filter). The `let mounted = false` guard in each `clientEntry` closure prevents re-attaching the right-click event listener when the Frame content is replaced, so the context menu never opens again until a full page reload. This is a regression that makes grid operations like changing sort order destroy row-level interactivity.

## What Changes

- Fix the `mounted`-flag pattern in all 7 admin context menu `clientEntry` files so the event listener re-attaches after Frame DOM replacement
- Standardize on a `ref()`-based pattern with per-installation cleanup via the ref's AbortSignal — works correctly on both `handle.update()` and Frame content replacement
- No changes to server-side logic, routing, or menu structure

## Capabilities

### New Capabilities

None — this is a bug fix to existing functionality.

### Modified Capabilities

- `nutzer-context-menu`: Add non-regression requirement — context menu SHALL remain functional after Frame-targeted navigation (sort, paginate, filter)
- `offerings-context-menu`: Same non-regression requirement
- `admin-appointments-context-menu`: Same non-regression requirement

(All other context menus — admin-resources, admin-offering-configs, admin-users, client-grid-inline-edit — are implicitly covered by the same underlying fix but do not need individual spec changes since they share the same pattern.)

## Impact

7 clientEntry files in `app/assets/`:
- `nutzer-table-interactive.tsx` — convert from `getElementById` + `mounted` to `ref()`-based pattern
- `admin-resources-context-menu.tsx` — remove `mounted` guard from `ref()` callback
- `admin-offering-configs-context-menu.tsx` — same
- `admin-users-context-menu.tsx` — same
- `admin-offerings-context-menu.tsx` — same
- `admin-appointments-context-menu.tsx` — same
- `client-grid-inline-edit.tsx` — same (if it uses the pattern)

No server-side, routing, data, or CSS impact.
