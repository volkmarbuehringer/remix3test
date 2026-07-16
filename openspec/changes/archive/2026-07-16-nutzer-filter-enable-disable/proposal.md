## Why

The `/admin/users` page lists all registered users but has no way to filter by enabled/disabled status, and the right-click context menu only offers Bearbeiten and Löschen — no way to quickly disable or re-enable a user account. Administrators need both features for efficient user management.

## What Changes

- **Status filter**: Add `?filter=enabled` and `?filter=disabled` support to `/admin/users`. `filter=disabled` shows users where `disabled_at IS NOT NULL`; `filter=enabled` shows users where `disabled_at IS NULL`.
- **Filter bar dropdown**: Add a dropdown alongside the text search to select "Alle", "Aktiv", "Deaktiviert".
- **Context menu**: Add "Deaktivieren" / "Aktivieren" menu items to the right-click context menu on user table rows.
- **Backend endpoint**: Add `POST /admin/users/:id/toggle-disabled` that toggles `disabled_at` between `null` (enabled) and `Date.now()` (disabled).
- **Edit panel**: Add a "Deaktiviert" checkbox (or disabled status indicator) to the inline edit form.

## Capabilities

### New Capabilities
- `admin-user-toggle-disable`: Enable/disable user accounts via context menu and edit panel, backed by the `disabled_at` column.

### Modified Capabilities
- `nutzer-status-filter`: Status-based filtering of the users table by `disabled_at` via `?filter=enabled|disabled` query parameter and a filter bar dropdown.

## Impact

- `app/routes.ts` — Add `toggleDisabled` route to the `users` route definition under `admin`
- `app/actions/admin/users/controller.tsx` — Add `toggleDisabled` action handler; modify `index` to handle `filter=enabled`/`filter=disabled`; add `disabled_at` to the `SafeUser` type
- `app/ui/admin-users-page.tsx` — Add status filter dropdown to filter bar; show disabled status in table; add disabled checkbox to edit panel
- `app/assets/admin-users-context-menu.tsx` — Add enable/disable menu items with fetch logic
- `app/actions/admin/admin-users.test.ts` — Add tests for status filter and toggle-disabled endpoint
