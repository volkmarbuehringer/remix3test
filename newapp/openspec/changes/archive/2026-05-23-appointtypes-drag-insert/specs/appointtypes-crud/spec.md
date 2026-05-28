## Purpose

How appointment types are created, displayed, renamed, and deleted.

## Requirements

### Requirement: Appointtypes table

The system SHALL store appointment types in an `appointtypes` PostgreSQL table.

#### Scenario: Table auto-created on startup

- **WHEN** the server starts
- **THEN** the `appointtypes` table SHALL exist with columns: `id` (integer PK), `user_id` (integer FK → users), `title` (text, required), `created_at` (bigint), `updated_at` (bigint)

#### Scenario: New type created

- **WHEN** a user creates an appointment type
- **THEN** it SHALL be stored with `created_at` and `updated_at` set to the current time

#### Scenario: Type updated

- **WHEN** a user updates an appointment type
- **THEN** `updated_at` SHALL be updated to the current time

#### Scenario: Types scoped to user

- **WHEN** a user lists appointment types
- **THEN** only types belonging to that user SHALL be returned

### Requirement: Types panel in appointment page

The system SHALL display a types management panel loaded as a Remix Frame below the appointment sidebar.

#### Scenario: Frame loads on page visit

- **WHEN** a user visits the appointment page
- **THEN** a `<Frame>` SHALL load `/appointment/types` and display the types panel below the sidebar

#### Scenario: Types list alphabetical

- **WHEN** the types panel renders
- **THEN** types SHALL appear in alphabetical order by title

### Requirement: Create appointment type

The system SHALL allow users to create a new appointment type via an inline input.

#### Scenario: Add type button

- **WHEN** a user clicks the [+ Add Type] button
- **THEN** a new row SHALL appear at the top of the types list with a text `<input>` focused

#### Scenario: Commit new type

- **WHEN** a user types a title and presses Enter
- **THEN** the system SHALL POST the new type to the server and add it to the list

#### Scenario: Cancel new type

- **WHEN** a user presses Escape while the add input is focused
- **THEN** the input SHALL be dismissed without creating a type

#### Scenario: Empty title rejected

- **WHEN** a user submits an empty or whitespace-only title
- **THEN** the type SHALL NOT be created and the input SHALL be dismissed silently

### Requirement: Rename appointment type

The system SHALL allow users to rename a type by clicking its title.

#### Scenario: Click to edit

- **WHEN** a user clicks a type title
- **THEN** the title SHALL become an editable `<input>` with the current value

#### Scenario: Save rename

- **WHEN** a user modifies the title and presses Enter or blurs the input
- **THEN** the system SHALL PUT the updated title to the server

#### Scenario: Cancel rename

- **WHEN** a user presses Escape while editing
- **THEN** the input SHALL revert to the original title

#### Scenario: Empty rename rejected

- **WHEN** a user clears the title and blurs or presses Enter
- **THEN** the title SHALL revert to the original value

### Requirement: Delete appointment type

The system SHALL allow users to delete a type via a context menu.

#### Scenario: Right-click context menu

- **WHEN** a user right-clicks on a type row
- **THEN** a context menu SHALL appear with "Bearbeiten" and "Löschen" options

#### Scenario: Delete confirmation

- **WHEN** a user selects "Löschen" from the context menu
- **THEN** a confirmation dialog SHALL appear before deleting

#### Scenario: Type deleted

- **WHEN** the user confirms deletion
- **THEN** the system SHALL DELETE the type from the server and remove it from the list
