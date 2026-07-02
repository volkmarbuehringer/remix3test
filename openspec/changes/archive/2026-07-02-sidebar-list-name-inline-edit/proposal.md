## Why

The lists sidebar (`/lists`) displays each list's name from the `description` database column. Currently, renaming a list requires the user to:
1. Navigate to the admin area
2. Find the list in a table
3. Edit it there

There is no way to rename a list directly from the `/lists` page where users spend all their time. This breaks the flow — users should be able to correct a typo or rename a list inline without leaving the sidebar.

## What Changes

- Add **double-click to rename** on each list name in the sidebar
- An inline `<input>` replaces the `<span>` text on double-click
- Save the new name via `PUT /lists/:id/update` (JSON — endpoint already exists)
- On success, update the sidebar span with the new name (no page reload)
- On Escape or blur without change, revert to the original name
- Only affect the user-facing `/lists` sidebar (not admin)

## Impact

- `app/ui/lists-layout.tsx` — add inline-edit state and input markup
- `app/actions/lists/controller.tsx` — add a dedicated `rename` action (or reuse `update`)
- New client-entry component (or inline script) for the double-click + save interaction
- Minimal: no new DB columns, no new routes, no new API endpoints
