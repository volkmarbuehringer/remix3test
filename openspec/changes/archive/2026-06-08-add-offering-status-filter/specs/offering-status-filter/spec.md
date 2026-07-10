## ADDED Requirements

### Requirement: Admin can filter offerings by status

The offerings admin page SHALL provide a button group to switch between pending and expired offerings. Pending SHALL be the default view.

#### Scenario: Default view shows pending offerings

- **WHEN** the user navigates to `/verwaltung/offerings` without a `status` query parameter
- **THEN** the system SHALL display only offerings with a future date (day >= now) AND the "Ausstehend" button SHALL be visually active

#### Scenario: Switch to expired offerings

- **WHEN** the user selects "Abgelaufen" in the button group
- **THEN** the system SHALL reload the grid showing only offerings with a past date (day < now) AND the URL SHALL include `status=expired`

#### Scenario: Status is preserved across pagination

- **WHEN** the user navigates to the next page while `status=expired` is active
- **THEN** the next page SHALL also filter by expired offerings

#### Scenario: Status is preserved across sort changes

- **WHEN** the user clicks a sortable column header while a status filter is active
- **THEN** the sort change SHALL preserve the current `status` parameter

#### Scenario: Status is preserved across period filter changes

- **WHEN** the user selects a period filter while a status filter is active
- **THEN** the period SHALL be ANDed with the status filter

#### Scenario: Status is preserved across search

- **WHEN** the user performs a text search while a status filter is active
- **THEN** the search SHALL be ANDed with the status filter

#### Scenario: Status is preserved in create/edit/cancel redirects

- **WHEN** the user creates, edits, or cancels an offering and is redirected back to the list
- **THEN** the redirect SHALL preserve the current `status` parameter

#### Scenario: Grid state hidden inputs include status

- **WHEN** the user opens the create or edit panel while a status filter is active
- **THEN** the hidden grid state inputs on the form SHALL include the `status` value so it survives form submission

#### Scenario: Status is preserved in config panel toggle

- **WHEN** the user opens or closes the offering config panel while a status filter is active
- **THEN** the grid state SHALL preserve the `status` parameter
