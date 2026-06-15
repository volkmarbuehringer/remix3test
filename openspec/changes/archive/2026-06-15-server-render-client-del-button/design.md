## Context

The `/client` grid uses a Remix Frame to render the table. Each row has a "Del" button backed by `DelButton` — a `clientEntry` component that overrides form submission with `fetch()` + `handle.frame?.reload()` to avoid full-page navigation. This creates 50+ `clientEntry` hydration markers at pageSize=50, which share the Frame's scheduler. During pagination, cached module loads cause synchronous hydration of all markers, incrementing the scheduler's `cascadingUpdateCount` past the 50-loop threshold.

The `/nutzer` page proves the alternative: server-rendered forms with `data-confirm` for confirmation, and a single `clientEntry` (`NutzerTableInteractive`) for the context menu via event delegation.

## Goals / Non-Goals

**Goals:**
- Eliminate per-row `clientEntry` components from the client grid
- Maintain inline delete without full-page refresh
- Keep confirmation dialog before delete
- Preserve grid state (offset, sort, filter) after delete

**Non-Goals:**
- Changing the `FrameRefreshButton` component (kept as clientEntry)
- Changing the Edit button (already server-rendered)
- Changing the nutzer page or any other page
- Fixing the underlying Remix scheduler counter (framework issue)

## Decisions

1. **Frame navigation over fetch+reload**: Instead of `fetch()` + `handle.frame.reload()`, use a standard `<form method="POST">` with `rmx-target="client-grid"`. The Frame intercepts submissions and navigates the target, avoiding full-page reload while still being fully server-driven.

2. **Redirect to `/client/grid` instead of `/client`**: After delete, the server redirects to `/client/grid?<grid-state>`. Since the Frame's navigation target is `client-grid`, the Frame fetches this URL. The grid action detects the Frame request (`X-Remix-Frame`) and returns just the grid fragment without the Layout wrapper.

3. **`data-confirm` for delete confirmation**: Use the existing global `ConfirmDelete` clientEntry (already imported in `app/assets/confirm-delete.tsx` and present in the document shell). No confirmation JS needed per row.

4. **Hidden inputs for grid state**: Use `GridStateHiddenInputs` (already exists at `app/ui/grid-state-hidden.tsx`) to carry `_offset`, `_sort`, `_order`, `_filter` through the form POST to the destroy action.

## Risks / Trade-offs

- **Frame navigation fires redirect** and the Frame fetches the redirect target. Since we redirect to `/client/grid`, this works. But if the redirect target were `/client` (full page layout), the Frame would render a layout inside itself — broken. The destroy action must redirect to `/client/grid`.
- **The existing `DelButton` uses non-standard confirmation** — it calls `handle.frame.reload()` after the fetch. The redirect-based approach is more natural for Remix Frame navigation.
