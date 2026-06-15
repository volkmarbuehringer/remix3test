## Why

The `/client` grid uses per-row `DelButton` components wrapped in `clientEntry`, creating 50+ hydration markers per page at pageSize=50. This triggers the Remix scheduler's `MAX_CASCADING_UPDATES=50` limit during pagination because cached module loads cause synchronous hydrations that all share the Frame's scheduler. The `/nutzer` page avoids this by using server-rendered forms with event delegation.

## What Changes

- **Convert `DelButton` from `clientEntry` to server-rendered form** — use standard `<form method="POST" data-confirm="...">` with `rmx-target="client-grid"` for frame-aware navigation, eliminating per-row `clientEntry` dependencies.
- **Change `destroy` action redirect target** — redirect to `/client/grid?` instead of `/client?` so the Frame navigates to the grid fragment (no full layout) after a delete.
- **Remove `client-del-button.tsx`** — no longer needed as a clientEntry asset.

## Capabilities

### New Capabilities
- `server-render-del-button`: Replace per-row clientEntry delete buttons with server-rendered forms using frame navigation

### Modified Capabilities


## Impact

- `app/actions/client/controller.tsx` — destroy action redirect target
- `app/actions/client/grid-page.tsx` — inline delete form replacing DelButton import
- `app/assets/client-del-button.tsx` — delete entire file
- `app/assets/grid-refresh-button.tsx` — unaffected, kept as-is
- Removes 50 hydration markers per page (at pageSize=50), dropping total from 51 to 1
