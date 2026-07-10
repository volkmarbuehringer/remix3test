## ADDED Requirements

### Requirement: Right-click opens context menu on appointment rows

When a user right-clicks anywhere on an appointment row in the admin appointments table, a context menu SHALL appear at the pointer position with available actions.

#### Scenario: Right-click on row opens context menu

- **WHEN** the user right-clicks on any cell of an appointment table row
- **THEN** a context menu appears at the pointer coordinates with items "Edit" and "Delete"

#### Scenario: Right-click outside rows does not open context menu

- **WHEN** the user right-clicks on the table header, pagination area, or empty space
- **THEN** no context menu appears

#### Scenario: Context menu supports keyboard opening

- **WHEN** a table row has focus and the user presses the Context Menu key or Shift+F10
- **THEN** the context menu opens at the center of the focused row

### Requirement: Context menu offers Edit action

The context menu SHALL include an "Edit" item that navigates to the inline editing mode for the right-clicked appointment, preserving the current grid state (offset, sort, order, filter).

#### Scenario: Edit action navigates to inline editing

- **WHEN** the user right-clicks an appointment row and selects "Edit"
- **THEN** the page navigates to `/admin/appointments?editing=<id>&...` with the current grid state parameters preserved
- **AND** the inline edit panel appears in the right column

### Requirement: Context menu offers Delete action

The context menu SHALL include a "Delete" item that removes the right-clicked appointment via the existing DELETE form submission path.

#### Scenario: Delete action removes the appointment

- **WHEN** the user right-clicks an appointment row and selects "Delete"
- **THEN** a confirmation dialog appears: "Wirklich löschen?"
- **WHEN** the user confirms
- **THEN** the appointment is deleted via POST with `_method=DELETE`
- **AND** the table refreshes to the same grid page

#### Scenario: Delete action can be cancelled

- **WHEN** the user right-clicks an appointment row, selects "Delete"
- **THEN** a confirmation dialog appears
- **WHEN** the user cancels
- **THEN** no deletion occurs
- **AND** the context menu closes

### Requirement: Context menu survives Frame navigation

The context menu SHALL remain functional after any Frame-targeted navigation (sort, paginate, filter). A full page reload SHALL NOT be required to re-enable the context menu.

#### Scenario: Context menu works after sort

- **GIVEN** the appointments table renders with data
- **WHEN** a user clicks a sortable column header to change sort order
- **AND** the Frame content updates with the new sort
- **THEN** right-clicking on any row SHALL still open the context menu

#### Scenario: Context menu works after pagination

- **GIVEN** the appointments table renders with multiple pages
- **WHEN** a user clicks "Weiter" to navigate to the next page
- **AND** the Frame content updates with the next page
- **THEN** right-clicking on any row SHALL still open the context menu

#### Scenario: Context menu works after filter

- **GIVEN** the appointments table renders with data
- **WHEN** a user submits a filter search
- **AND** the Frame content updates with filtered results
- **THEN** right-clicking on any row SHALL still open the context menu
