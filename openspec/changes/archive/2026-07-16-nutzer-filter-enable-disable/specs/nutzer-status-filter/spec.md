## ADDED Requirements

### Requirement: Filter by disabled status

The `/admin/users` page SHALL support filtering by enabled/disabled status via the `filter` query parameter, using the special values `enabled` and `disabled`.

#### Scenario: Filter by disabled users

- **WHEN** an admin navigates to `/admin/users?filter=disabled`
- **THEN** the table SHALL display only users where `disabled_at IS NOT NULL`
- **AND** the filter bar dropdown SHALL show "Deaktiviert" as selected

#### Scenario: Filter by enabled users

- **WHEN** an admin navigates to `/admin/users?filter=enabled`
- **THEN** the table SHALL display only users where `disabled_at IS NULL`
- **AND** the filter bar dropdown SHALL show "Aktiv" as selected

#### Scenario: No filter shows all users

- **WHEN** an admin navigates to `/admin/users` without a `filter` param
- **THEN** the table SHALL display all users (no status filter applied)
- **AND** the filter bar dropdown SHALL show "Alle" as selected

### Requirement: Status filter dropdown in filter bar

The `/admin/users` filter bar SHALL include a dropdown selector with options "Alle", "Aktiv", and "Deaktiviert".

#### Scenario: Dropdown selection navigates with filter param

- **WHEN** an admin selects "Aktiv" from the status dropdown
- **THEN** the browser SHALL navigate to `/admin/users?filter=enabled`
- **AND** the table SHALL reload showing only active users

#### Scenario: "Alle" resets filter

- **WHEN** an admin selects "Alle" from the status dropdown
- **THEN** the browser SHALL navigate to `/admin/users`
- **AND** the table SHALL reload showing all users

### Requirement: Status filter preserves sort state

- **WHEN** an admin has sorted by "Name" and selects "Deaktiviert" from the dropdown
- **THEN** the table SHALL reload with the filter applied and sort preserved

### Requirement: Status filter resets pagination

- **WHEN** an admin is on page 2 and selects "Aktiv" from the dropdown
- **THEN** the table SHALL reload at offset 0

### Requirement: Text search and status filter are mutually exclusive

- **WHEN** an admin has `?filter=disabled` active and types a name in the search input
- **THEN** submitting the search SHALL navigate to `?filter=<text>`
- **AND** the status dropdown SHALL show "Alle"

- **WHEN** an admin has `?filter=<text>` active and selects "Deaktiviert" from the dropdown
- **THEN** the browser SHALL navigate to `?filter=disabled`
- **AND** the search input SHALL be empty

### Requirement: Status filter survives edit/create/destroy

- **WHEN** an admin is on `/admin/users?filter=disabled` and saves an edit or creates a user
- **THEN** the redirect SHALL preserve `?filter=disabled`

### Requirement: Disabled state visible in table

The table SHALL show a visual indicator for disabled users (e.g., muted styling or a badge).

#### Scenario: Disabled user row is visually distinct

- **WHEN** a user has `disabled_at IS NOT NULL`
- **THEN** their table row SHALL have a visual indicator distinguishing them from active users

## ADDED Requirements

### Requirement: Toggle disable endpoint

The system SHALL expose `POST /admin/users/:id/toggle-disabled` that toggles a user's `disabled_at` column between `null` and `Date.now()`.

#### Scenario: Toggle disabled

- **WHEN** a POST request is made to `/admin/users/5/toggle-disabled` with a valid CSRF token
- **AND** user 5 has `disabled_at = null`
- **THEN** the response SHALL be `{ ok: true, disabled: true }`
- **AND** `disabled_at` SHALL be set to a timestamp

#### Scenario: Toggle enabled

- **WHEN** a POST request is made to `/admin/users/5/toggle-disabled` with a valid CSRF token
- **AND** user 5 has `disabled_at` set to a timestamp
- **THEN** the response SHALL be `{ ok: true, disabled: false }`
- **AND** `disabled_at` SHALL be set to `null`

#### Scenario: Toggle non-existent user returns 404

- **WHEN** a POST request is made to `/admin/users/9999/toggle-disabled`
- **THEN** the response SHALL have status 404

### Requirement: Context menu enable/disable

The right-click context menu on user table rows SHALL include "Deaktivieren" or "Aktivieren" based on the user's current `disabled_at` state.

#### Scenario: Context menu shows Deaktivieren for active user

- **WHEN** an admin right-clicks a row where `disabled_at IS NULL`
- **THEN** the context menu SHALL show "Deaktivieren"

#### Scenario: Context menu shows Aktivieren for disabled user

- **WHEN** an admin right-clicks a row where `disabled_at IS NOT NULL`
- **THEN** the context menu SHALL show "Aktivieren"

#### Scenario: Toggle via context menu

- **WHEN** an admin selects "Deaktivieren" from the context menu
- **THEN** a POST request SHALL be sent to `/admin/users/:id/toggle-disabled`
- **AND** the page SHALL reload reflecting the new state

### Requirement: Edit panel disabled checkbox

The inline edit panel SHALL include a checkbox for the disabled state.

#### Scenario: Edit panel shows disabled checkbox

- **WHEN** an admin opens the edit panel for a user
- **THEN** the form SHALL include a "Deaktiviert" checkbox
- **AND** it SHALL be checked if `disabled_at IS NOT NULL`
- **AND** saving the form SHALL update `disabled_at` accordingly
