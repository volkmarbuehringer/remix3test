## ADDED Requirements

### Requirement: Multirow delete at /admin/uploads/delete-many

The system SHALL expose a multirow delete action for the uploads grid at `POST /admin/uploads/delete-many` that deletes the selected upload rows in a single operation. The action SHALL honor the same ownership split as single-row delete: an admin SHALL be able to delete any row, and a non-admin SHALL delete only rows they uploaded (claimed); any selected row the caller does not own SHALL be left untouched. The response SHALL redirect back to the uploads grid preserving the current page, sort column, sort direction, and filter.

#### Scenario: Admin bulk-deletes selected rows

- **WHEN** an admin submits a POST to `/admin/uploads/delete-many` with the ids of several selected rows
- **THEN** every selected row SHALL be deleted
- **AND** the response SHALL redirect back to the uploads grid

#### Scenario: Non-admin bulk-deletes only their own rows

- **WHEN** a non-admin submits a POST to `/admin/uploads/delete-many` with a mix of their own ids and another user's id
- **THEN** the non-admin's own rows SHALL be deleted
- **AND** the other user's row SHALL remain

#### Scenario: Bulk delete preserves the grid view

- **WHEN** a user submits a POST to `/admin/uploads/delete-many` that carries the grid state fields (`_page`, `_sort`, `_order`, `_filter`)
- **THEN** the redirect SHALL resolve to the same page, sort, order, and filter on the uploads grid

#### Scenario: Bulk delete with no valid ids is a no-op

- **WHEN** a user submits a POST to `/admin/uploads/delete-many` with no valid selected id
- **THEN** no row SHALL be deleted
- **AND** the response SHALL still redirect back to the uploads grid without an error

### Requirement: Bulk delete action path resolves as a GET

The system SHALL serve `GET /admin/uploads/delete-many` and render the uploads grid, so the frame runtime can reload the committed action path after the bulk-delete POST the same way the single delete resolver works (the form action equals the frame `src`; see the admin chatlog/messages `destroyResolve` pattern).

#### Scenario: GET /admin/uploads/delete-many renders the uploads page

- **WHEN** an authenticated user GETs `/admin/uploads/delete-many`
- **THEN** the response SHALL have status 200
- **AND** SHALL render the uploads page

### Requirement: Uploads grid exposes multirow selection and a bulk action

The system SHALL render the uploads grid with a per-row checkbox and a header toggle to select all rows on the current page, plus a bulk action control labeled "Ausgewählte löschen" that submits the selected rows to the bulk delete action. The bulk action SHALL NOT be enabled when no row is selected, and the grid SHALL confirm the delete with the number of selected rows before submitting.

#### Scenario: Grid renders selection controls and a bulk button

- **WHEN** the uploads grid is rendered with rows
- **THEN** the table SHALL contain a checkbox input per row named for the id
- **AND** SHALL contain a header toggle to select all visible rows
- **AND** SHALL contain a bulk action button labeled "Ausgewählte löschen"

#### Scenario: Bulk action is disabled when nothing is selected

- **WHEN** the uploads grid is rendered with no row selected
- **THEN** the bulk action button SHALL be disabled
