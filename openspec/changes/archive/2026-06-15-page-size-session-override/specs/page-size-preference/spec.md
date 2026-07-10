## ADDED Requirements

### Requirement: Page size selector in settings

The settings page SHALL display a dropdown to select the number of items shown per page on paginated lists. The available options SHALL be 10, 15, 20, 25, and 50. The currently active override SHALL be preselected, or the default value (15) SHALL be preselected when no override is set.

#### Scenario: Page size dropdown renders on settings page

- **WHEN** a user navigates to the settings page
- **THEN** the page displays a dropdown labeled "Einträge pro Seite" with options 10, 15, 20, 25, 50

#### Scenario: Current override value is preselected

- **WHEN** a user has previously set a page size override of 25 via the session
- **THEN** the dropdown on the settings page preselected value is 25

### Requirement: Save page size to session

When the user submits the page size form, the system SHALL store the selected value in the session as `session.set('pageSize', N)`. Only valid values (10, 15, 20, 25, 50) SHALL be accepted. The action SHALL redirect back to the settings page.

#### Scenario: Valid page size stored in session

- **WHEN** a user selects 25 from the dropdown and submits the form
- **THEN** `session.get('pageSize')` returns 25 and the response redirects to the settings page

#### Scenario: Invalid page size is rejected

- **WHEN** a user submits a page size value of 99
- **THEN** the value is ignored and the session override remains unchanged

### Requirement: Session override applied to paginated controllers

All paginated controllers SHALL read `session.get('pageSize')` before falling back to their hardcoded default. When a valid override exists, it SHALL be used as the `pageSize` parameter for pagination queries.

#### Scenario: Override affects all paginated lists

- **WHEN** a user sets page size to 50 in settings
- **THEN** the admin users list returns up to 50 items per page instead of the default 15

#### Scenario: Override reverts on logout

- **WHEN** a user logs out and logs back in
- **THEN** all paginated lists use their hardcoded defaults (session cleared)

### Requirement: Shared helper function

The page size lookup logic SHALL be encapsulated in a shared helper function to avoid duplication across 13 controllers.

#### Scenario: Helper returns override when valid

- **WHEN** session contains pageSize=25
- **THEN** `getPageSize(context, 15)` returns 25

#### Scenario: Helper returns default when no override

- **WHEN** session contains no pageSize value
- **THEN** `getPageSize(context, 15)` returns 15

#### Scenario: Helper returns default when override is invalid

- **WHEN** session contains pageSize=99
- **THEN** `getPageSize(context, 15)` returns 15
