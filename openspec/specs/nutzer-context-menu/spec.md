## Purpose

How the Nutzer (German user management) admin table provides row-level actions through a right-click context menu, replacing the existing Actions column. The nutzer page is now at `/nutzer` (top-level route).

## Requirements

### Requirement: Replace Actions column with context menu

The Nutzer admin table SHALL remove the dedicated "Aktionen" column (header + per-row Edit/Delete buttons) and instead surface those actions — plus additional secondary actions — through a right-click context menu on each table row.

#### Scenario: Actions column removed

- **GIVEN** the Nutzer table renders with data rows
- **WHEN** the page loads
- **THEN** there SHALL be no "Aktionen" column header
- **AND** no per-row Edit/Delete buttons in the table

#### Scenario: Context menu replaces Actions

- **GIVEN** a Nutzer table row
- **WHEN** a user right-clicks anywhere on the row (or presses Shift+F10 while focused)
- **THEN** a context menu SHALL appear at the click/keyboard coordinates
- **AND** the context menu SHALL contain the actions listed in the Menu Structure section

#### Scenario: Context menu only on rows

- **GIVEN** the Nutzer page is rendered
- **WHEN** a user right-clicks on the filter bar, pagination, toolbar, or page background
- **THEN** no context menu SHALL appear

### Requirement: Menu structure

The context menu SHALL present actions in three groups separated by `<hr />`:

1. **Primary group**: Edit, Reset Password
2. **Secondary group**: Lock/Unlock (conditional), Copy Email
3. **Destructive group**: Delete

#### Scenario: Edit action

- **GIVEN** a context menu is open on a row
- **WHEN** the user selects "Bearbeiten"
- **THEN** the application SHALL navigate to the inline edit sidebar for that row
- **AND** preserve the current pagination offset, sort column, sort direction, and filter state

#### Scenario: Reset Password action

- **GIVEN** a context menu is open on a row
- **WHEN** the user selects "Passwort zurücksetzen"
- **THEN** the system SHALL generate a new random 12-character password
- **AND** hash it with scrypt and store it in the database
- **AND** display the new temporary password to the user
- **AND** the page SHALL reload to reflect changes

#### Scenario: Lock/Unlock toggle (conditional)

- **GIVEN** a context menu is open on a row where `l_gesperrt` is `true`
- **WHEN** the user selects "Entsperren"
- **THEN** the system SHALL set `l_gesperrt = false` via POST to `/nutzer/:id/toggle-lock`
- **AND** the page SHALL reload

- **GIVEN** a context menu is open on a row where `l_gesperrt` is `false`
- **WHEN** the user selects "Sperren"
- **THEN** the system SHALL set `l_gesperrt = true` via POST to `/nutzer/:id/toggle-lock`
- **AND** the page SHALL reload

#### Scenario: Copy Email action

- **GIVEN** a context menu is open on a row that has an email address
- **WHEN** the user selects "E-Mail kopieren"
- **THEN** the email address SHALL be copied to the system clipboard
- **AND** no server request SHALL be made

- **GIVEN** a context menu is open on a row with a null/empty email
- **WHEN** the menu renders
- **THEN** the "E-Mail kopieren" item SHALL appear but be disabled
- **AND** selecting it SHALL do nothing

#### Scenario: Delete action with confirmation

- **GIVEN** a context menu is open on a row
- **WHEN** the user selects "Löschen"
- **THEN** a confirmation dialog SHALL appear asking to confirm deletion
- **AND** if confirmed, a DELETE request SHALL be sent to `/nutzer/:id`
- **AND** the page SHALL reload
- **AND** if cancelled, no request SHALL be made

### Requirement: Per-row context scoping

Each table row SHALL have its own `menu.Context` scope so that menu item handlers close over their row's data directly.

#### Scenario: Row data bound to handler

- **GIVEN** a table with multiple rows
- **WHEN** a user right-clicks row A and selects "Edit"
- **THEN** the edit sidebar SHALL open with row A's data
- **AND** this SHALL be independent of any other row's menu

### Requirement: Colgroup redistribution

The removal of the Actions column SHALL redistribute its width proportionally across remaining columns to prevent a gap.

#### Scenario: Column widths adjusted

- **GIVEN** the Nutzer table `colgroup` currently has 9 columns
- **WHEN** the Actions column is removed
- **THEN** the `colgroup` SHALL have 8 columns
- **AND** the remaining columns SHALL be adjusted so the table fills its container

### Requirement: Backend — Reset Password endpoint

A dedicated endpoint SHALL support password reset as a server action.

#### Scenario: Reset Password API

- **GIVEN** a POST request to `/nutzer/:id/reset-password` with a valid CSRF token
- **WHEN** the user exists
- **THEN** a new password SHALL be generated (12 chars, mixed case + digits)
- **AND** hashed with scrypt and stored
- **AND** a JSON response SHALL be returned: `{ "password": "newPlaintext" }`

- **GIVEN** a POST request to `/nutzer/:id/reset-password`
- **WHEN** the user does not exist
- **THEN** a 404 JSON response SHALL be returned

### Requirement: Backend — Lock/Unlock via toggle endpoint

A dedicated endpoint SHALL support toggling lock state as a server action.

#### Scenario: Lock/Unlock API

- **GIVEN** a POST request to `/nutzer/:id/toggle-lock` with `{ "locked": true }`
- **WHEN** the user exists
- **THEN** the `l_gesperrt` column SHALL be updated to `true`
- **AND** a JSON response SHALL be returned with `{ "ok": true }`

### Requirement: Backend — Active toggle via toggle endpoint

A dedicated endpoint SHALL support toggling active state as a server action.

#### Scenario: Active toggle API

- **GIVEN** a POST request to `/nutzer/:id/toggle-active` with `{ "active": false }`
- **WHEN** the user exists
- **THEN** the `l_aktiv` column SHALL be updated to `false`
- **AND** a JSON response SHALL be returned with `{ "ok": true }`
