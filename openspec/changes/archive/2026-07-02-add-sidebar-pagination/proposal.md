## Why

Users with many saved lists can't see lists beyond the first 50 in the sidebar. The server already supports offset-based pagination and returns `hasMore`, but the sidebar renders all entries at once with no way to page through them.

## What Changes

- Add "Load more" / "Previous" navigation below the sidebar list entries
- Expose the pagination offset from the lists controller to the sidebar layout
- Wire pagination actions (next/previous page) through the existing frame navigation mechanism
- Preserve the active list highlight across page changes

## Capabilities

### New Capabilities
- `sidebar-list-pagination`: Offset-based pagination for the lists sidebar with next/previous controls and page tracking

### Modified Capabilities

*(No existing spec-level behavior changes — only new UI capability added.)*

## Impact

- `app/actions/lists/controller.tsx` — pass `offset`, `hasMore`, `limit` to the sidebar render
- `app/ui/lists-layout.tsx` — add pagination nav buttons below list entries
- `app/lib/lists-api.ts` — already supports pagination, no changes needed
