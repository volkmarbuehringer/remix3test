## ADDED Requirements

### Requirement: Admin can filter appointments by status

The appointments admin page SHALL provide a radio button group to switch between pending and expired appointments. Pending SHALL be the default view.

#### Scenario: Default view shows pending appointments

- **WHEN** the user navigates to `/verwaltung/appointments` without a `status` query parameter
- **THEN** the system SHALL display only appointments with a future date (date >= now) AND the "Ausstehend" radio SHALL be visually selected

#### Scenario: Switch to expired appointments

- **WHEN** the user selects "Abgelaufen" in the radio group
- **THEN** the system SHALL reload the grid showing only appointments with a past date (date < now) AND the URL SHALL include `status=expired`

#### Scenario: Status is preserved across pagination

- **WHEN** the user navigates to the next page while `status=expired` is active
- **THEN** the next page SHALL also filter by expired appointments

#### Scenario: Status is preserved across sort changes

- **WHEN** the user clicks a sortable column header while a status filter is active
- **THEN** the sort change SHALL preserve the current `status` parameter

#### Scenario: Status is preserved across period filter changes

- **WHEN** the user selects a period filter (e.g., "Diese Woche") while `status=pending` is active
- **THEN** the period SHALL be ANDed with the status filter

#### Scenario: Status is preserved across search

- **WHEN** the user performs a text search while a status filter is active
- **THEN** the search SHALL be ANDed with the status filter

#### Scenario: Status is preserved in create/edit redirects

- **WHEN** the user creates or edits an appointment and is redirected back to the list
- **THEN** the redirect SHALL preserve the current `status` parameter

#### Scenario: Status is preserved in delete redirects

- **WHEN** the user deletes an appointment and is redirected back to the list
- **THEN** the redirect SHALL preserve the current `status` parameter

#### Scenario: Grid state hidden inputs include status

- **WHEN** the user opens the create or edit panel while a status filter is active
- **THEN** the hidden grid state inputs on the form SHALL include the `status` value so it survives form submission
