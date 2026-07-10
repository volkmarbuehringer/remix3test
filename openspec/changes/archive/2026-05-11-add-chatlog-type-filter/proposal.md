## Why

The admin chatlog browser shows all conversations (chat and agent) mixed together. Admins need to quickly filter by conversation type to focus on either simple chat logs or agent conversations with tool calls. Adding a `type` query parameter and sidebar shortcuts lets admins switch between "All", "Chat only", and "Agent only" views.

## What Changes

- Add `type` query parameter support to `/admin/chatlog` (`?type=chat` or `?type=agent`)
- Conversation filtering logic: agent conversations have `toolCalls` data on messages; chat conversations don't
- Add two new nav items to the admin sidebar under "Data": "Chat Only" and "Agent Only"
- Add a new `type` column showing active filter in the chatlog page UI
- Preserve `type` parameter across pagination

**No changes to**:

- Existing routes, middleware, database schema, or package.json

## Capabilities

### New Capabilities

- `chatlog-type-filter`: Query parameter filter (`?type=chat` / `?type=agent`) on `/admin/chatlog` that filters the conversation list based on whether messages contain tool calls, plus sidebar navigation entries for quick access

### Modified Capabilities

- (none — no existing specs to modify)

## Impact

**New files**: None

**Modified files**:

- `app/ui/admin-layout.tsx` — Add "Chat Only" and "Agent Only" nav items to the Data section, update `AdminNavItem` type and `navIcon` handler
- `app/actions/admin-chatlog-controller.tsx` — Parse `type` query param, filter conversations after fetching based on `toolCalls` presence
- `app/ui/admin-chatlog-page.tsx` — Accept `type` prop, display active filter, preserve `type` in pagination URLs

**Dependencies**: None required.
