## ADDED Requirements

### Requirement: Grid displays edit panel inline

When the URL includes an `editing=<rowId>` query parameter, the client lab page SHALL display the edit form inline alongside the grid, rather than navigating to a separate page.

#### Scenario: Edit button navigates to inline mode

- **WHEN** user clicks "Edit" on a grid row
- **THEN** the browser navigates to `/client?editing=<rowId>&offset=<current>&sort=<field>&order=<dir>&filter=<search>`
- **AND** the page renders both the grid frame and an edit panel

#### Scenario: Direct URL loads inline edit

- **WHEN** user navigates directly to `/client?editing=5&offset=0&sort=name&order=asc`
- **THEN** the page renders the grid frame and the edit panel for row ID 5

#### Scenario: No editing param renders grid only

- **WHEN** user navigates to `/client` without `?editing=` param
- **THEN** the page renders only the grid frame

### Requirement: Edit panel layout

The edit panel SHALL appear in a two-column layout alongside the grid frame when editing. The grid frame SHALL occupy the flexible `1fr` column, the edit panel SHALL occupy a fixed `380px` column.

#### Scenario: Two-column layout

- **WHEN** the page renders with an `?editing=` param
- **THEN** the grid is in the left column, the edit panel in the right column
- **AND** the edit panel uses `position: sticky; top: 1.5rem` to stay visible during scroll

#### Scenario: Single column layout

- **WHEN** the page renders without `?editing=` param
- **THEN** the page uses the standard single-column centered layout

### Requirement: Grid state preserved

All grid state (offset, sort field, sort order, filter text) SHALL be preserved through the edit and save lifecycle.

#### Scenario: Grid state in edit URL

- **WHEN** user clicks "Edit" on a grid row
- **THEN** the Edit button link SHALL include `offset`, `sort`, `order`, and `filter` params

#### Scenario: Grid state passed to save

- **WHEN** the edit form is submitted
- **THEN** hidden form fields SHALL carry `_offset`, `_sort`, `_order`, `_filter` values
- **AND** the save handler SHALL include these in the 302 redirect URL

#### Scenario: Grid state restored after save

- **WHEN** the save handler issues a 302 redirect after updating a row
- **THEN** the redirect URL SHALL include `offset`, `sort`, `order`, and `filter` params from the form submission
- **AND** the grid frame SHALL reload with these params preserved

### Requirement: Cancel returns to grid

The edit panel's Cancel button SHALL navigate to `/client` with the same `offset`, `sort`, `order`, and `filter` params but without `?editing=`.

#### Scenario: Cancel preserves grid state

- **WHEN** user clicks "Cancel" in the edit panel
- **THEN** the browser navigates to `/client?offset=<current>&sort=<field>&order=<dir>&filter=<search>`
- **AND** the edit panel is removed

### Requirement: Standalone edit route redirects

The standalone `/client/edit/:rowId` route SHALL redirect to the inline edit URL format.

#### Scenario: Redirect to inline

- **WHEN** a request is made to `GET /client/edit/5?offset=0&sort=name&order=asc`
- **THEN** the server responds with a 302 redirect to `/client?editing=5&offset=0&sort=name&order=asc`
