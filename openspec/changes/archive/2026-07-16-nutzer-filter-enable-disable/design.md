## Context

The `/admin/users` page serves a `users` table with columns: `id`, `email`, `password_hash`, `name`, `role`, `disabled_at` (nullable bigint — `null` = enabled, timestamp = disabled), `created_at`, `updated_at`. It uses the `resources()` route helper which auto-generates `index`, `create`, `update`, `destroy` endpoints. The controller uses `createController` with `requireAuth()` + `requireAdmin()` middleware.

The current filter mechanism uses trigram search (`ilike`) on `name` and `email`. The context menu only has "Bearbeiten" and "Löschen". The `disabled_at` column exists but is not exposed anywhere in the UI.

## Goals / Non-Goals

**Goals:**

- Add `?filter=enabled` and `?filter=disabled` support to the index handler
- Add a dropdown in the filter bar to select "Alle", "Aktiv", "Deaktiviert"
- Add enable/disable menu items to the right-click context menu
- Add a `POST /admin/users/:id/toggle-disabled` backend endpoint
- Show disabled status in the table (visual indicator)
- Add a disabled checkbox to the inline edit panel
- Preserve grid state (sort, offset, filter) across all actions

**Non-Goals:**

- No changes to authentication or authorization flows
- No changes to seed data
- No changes to the nutzer route (separate system)

## Decisions

### 1. New toggle-disabled endpoint (not repurposing the update handler)

**Decision**: Add a dedicated `POST /admin/users/:id/toggle-disabled` route and controller action that toggles `disabled_at` between `null` and `Date.now()`.

**Rationale**: The update handler already handles name/email/role/password changes. Adding disabled toggle there would require the context menu to submit a full update form. A dedicated endpoint is cleaner for a toggle action.

**Response**: Returns `{ ok: true, disabled: true/false }`.

### 2. Special filter values in the existing `filter` param

**Decision**: `filter=enabled` and `filter=disabled` are special values handled in the index action. `filter=enabled` adds `disabled_at IS NULL`, `filter=disabled` adds `disabled_at IS NOT NULL`. Other values continue as trigram text search.

**Rationale**: The entire grid state (offset, sort, filter) is already wired through `_filter` hidden inputs and `gridStateToParams()`. Adding a separate query param would require threading through all forms. The single-param approach is simpler.

### 3. Dropdown selector in filter bar

**Decision**: Add a `<select>` before the text input with "Alle" (value empty), "Aktiv" (value `enabled`), "Deaktiviert" (value `disabled`). Selecting an option navigates to `?filter=<value>`.

### 4. Grid state must include disabled status for context menu

**Decision**: The `displayUser` type in the grid state JSON gets a `disabled_at` field so the context menu knows whether to show "Aktivieren" or "Deaktivieren".

### 5. Edit panel disabled checkbox

**Decision**: The inline edit panel gets a checkbox "Deaktiviert" that sets `disabled_at` to `Date.now()` (checked) or `null` (unchecked). The update handler processes `disabled_at` alongside other fields.

**Rationale**: Administrators editing a user may want to disable/enable as part of the edit workflow, not just through the context menu.

## Risks / Trade-offs

- **[Low] Single filter param**: Text search and status filter can't coexist in the URL. The dropdown clears the text search and vice versa. Users needing both can apply a status filter and visually scan.
- **[Low] disabled_at via update**: Adding `disabled_at` handling to the update handler means the edit form's `_filter` hidden input must preserve the value through the redirect.
