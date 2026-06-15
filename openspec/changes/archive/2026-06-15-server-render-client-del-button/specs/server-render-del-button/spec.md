## ADDED Requirements

### Requirement: Delete button SHALL be server-rendered

The delete button for each row in the client grid SHALL be a server-rendered `<form>` element, not a `clientEntry` component. It SHALL use `rmx-target="client-grid"` for Frame-aware form submission and `data-confirm="Delete this row?"` for confirmation via the global `ConfirmDelete` handler.

The form SHALL include hidden inputs for grid state via `GridStateHiddenInputs` to preserve offset, sort, order, and filter across the roundtrip.

### Requirement: Destroy action SHALL redirect to /client/grid

The `destroy` action in the client controller SHALL redirect to `/client/grid?<grid-state>` instead of `/client?<grid-state>`. This ensures the Frame navigates to the grid fragment URL and renders only the grid content, not the full page layout.

### Requirement: Grid state SHALL be preserved after delete

After a successful delete and redirect, the grid SHALL display the same page, sort, and filter as before the delete. The offset SHALL adjust if the deleted row was the last item on the page.

#### Scenario: Delete a row triggers Frame navigation
- **WHEN** user clicks "Del" on a client row
- **THEN** a browser confirm dialog SHALL appear
- **WHEN** user confirms deletion
- **THEN** the form SHALL POST to `/client/<id>` with `rmx-target="client-grid"`
- **THEN** the server SHALL delete the row and redirect to `/client/grid` with preserved grid state
- **THEN** the Frame SHALL navigate to the redirect URL and display the updated grid

#### Scenario: Delete fails (row not found)
- **WHEN** the delete action receives an invalid or missing id parameter
- **THEN** the server SHALL return a 400 JSON response with `{ ok: false, error: 'Invalid id' }`
