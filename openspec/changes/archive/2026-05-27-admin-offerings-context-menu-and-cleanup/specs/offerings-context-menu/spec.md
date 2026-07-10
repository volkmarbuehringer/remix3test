## ADDED Requirements

### Requirement: Right-click opens context menu on offering rows

When a user right-clicks anywhere on an offering row in the admin offerings table, a context menu SHALL appear at the pointer position with Edit and Delete actions.

#### Scenario: Right-click on row opens context menu

- **WHEN** the user right-clicks on any cell of an offerings table row
- **THEN** a context menu appears at the pointer coordinates with items "Edit" and "Delete"

#### Scenario: Right-click outside rows does not open context menu

- **WHEN** the user right-clicks on the table header, pagination area, or empty space
- **THEN** no context menu appears

### Requirement: Context menu offers Edit action

The context menu SHALL include an "Edit" item that navigates to the inline editing mode for the right-clicked offering, preserving the current grid state (offset, sort, order, filter).

#### Scenario: Edit action navigates to inline editing

- **WHEN** the user right-clicks an offering row and selects "Edit"
- **THEN** the page navigates to `/admin/offerings?editing=<id>&...` with the current grid state parameters preserved
- **AND** the inline edit panel appears in the right column

### Requirement: Context menu offers Delete action

The context menu SHALL include a "Delete" item that removes the right-clicked offering via the existing DELETE form submission path.

#### Scenario: Delete action removes the offering

- **WHEN** the user right-clicks an offering row and selects "Delete"
- **THEN** a confirmation dialog appears: "Wirklich löschen?"
- **WHEN** the user confirms
- **THEN** the offering is deleted via POST with `_method=DELETE`
- **AND** the table refreshes to the same grid page

#### Scenario: Delete action can be cancelled

- **WHEN** the user right-clicks an offering row, selects "Delete"
- **THEN** a confirmation dialog appears
- **WHEN** the user cancels
- **THEN** no deletion occurs
- **AND** the context menu closes
