## ADDED Requirements

### Requirement: Appointments table

The system SHALL store appointments in an `appointments` PostgreSQL table.

#### Scenario: Table auto-created on startup

- **WHEN** the server starts
- **THEN** the `appointments` table SHALL exist with columns: `id` (integer PK), `user_id` (FK → users), `title` (text, required), `date` (timestamp, required), `start_min` (integer, required), `end_min` (integer, required), `created_at` (bigint), `updated_at` (bigint)

#### Scenario: New appointment created

- **WHEN** a user creates an appointment
- **THEN** it SHALL be stored with `created_at` and `updated_at` set to the current time

#### Scenario: Appointment updated

- **WHEN** a user updates an appointment
- **THEN** `updated_at` SHALL be updated to the current time

### Requirement: Week navigation

The system SHALL allow users to navigate between weeks using year and week number controls.

#### Scenario: Navigate by year dropdown

- **WHEN** a user selects a year from the dropdown
- **THEN** the grid SHALL display appointments for the selected year and current week number

#### Scenario: Navigate by week dropdown

- **WHEN** a user selects a week number from the dropdown
- **THEN** the grid SHALL display appointments for that week in the selected year

#### Scenario: Year dropdown range

- **WHEN** a user opens the year dropdown
- **THEN** the dropdown SHALL show years 2026 through 2030

#### Scenario: Default week

- **WHEN** a user visits `/appointment` for the first time
- **THEN** the grid SHALL default to the current week of the current year (clamped to 2026–2030)

#### Scenario: Date range display

- **WHEN** a week is selected
- **THEN** the sidebar SHALL show the computed date range (e.g., "Jun 1 – Jun 7, 2026")

### Requirement: Weekly grid view

The system SHALL display a 7-column weekly grid showing appointments for each day of the selected week.

#### Scenario: Grid columns

- **WHEN** the grid renders
- **THEN** it SHALL show 7 columns labeled Mon through Sun with dates

#### Scenario: Time slots

- **WHEN** the grid renders
- **THEN** each day column SHALL show time slots from midnight to midnight in configurable intervals

#### Scenario: Appointment blocks

- **WHEN** the grid renders appointments
- **THEN** each appointment SHALL appear as a positioned block spanning its time range in the correct day column

#### Scenario: Empty week

- **WHEN** no appointments exist for the selected week
- **THEN** the grid SHALL display the empty grid with a placeholder message

### Requirement: Create appointment

The system SHALL allow users to create new appointments by clicking on an empty time slot.

#### Scenario: Click empty slot

- **WHEN** a user clicks an empty time slot in the grid
- **THEN** a draft appointment block SHALL appear at that position

#### Scenario: Name the appointment

- **WHEN** a draft block appears
- **THEN** the user SHALL be able to type a title and press Enter to commit

#### Scenario: Save to server

- **WHEN** a user commits a new appointment
- **THEN** the system SHALL POST the new appointment to the server and display it in the grid

### Requirement: Update appointment

The system SHALL allow users to update appointments via drag, resize, and inline rename.

#### Scenario: Drag to move

- **WHEN** a user drags an appointment block to a different day or time
- **THEN** the block SHALL move to the new position and SHALL be saved to the server

#### Scenario: Resize duration

- **WHEN** a user drags the top or bottom edge of an appointment block
- **THEN** the block SHALL resize and SHALL be saved to the server

#### Scenario: Inline rename

- **WHEN** a user double-clicks an appointment title
- **THEN** the title SHALL become editable and SHALL be saved on Enter or blur

#### Scenario: Conflict resolution

- **WHEN** dragging or resizing would overlap another block
- **THEN** the layout SHALL resolve the overlap by shifting blocks

### Requirement: Delete appointment

The system SHALL allow users to delete appointments.

#### Scenario: Delete from sidebar

- **WHEN** a user hovers over an appointment in the sidebar
- **THEN** a delete button SHALL appear

#### Scenario: Confirm delete

- **WHEN** a user clicks the delete button
- **THEN** the appointment SHALL be deleted from the server and removed from the grid

### Requirement: Navigation

The system SHALL provide navigation to the appointment calendar from the main app navigation.

#### Scenario: Nav link

- **WHEN** a user views the main navigation
- **THEN** "Appointment" SHALL appear as a nav item

#### Scenario: Auth required

- **WHEN** an unauthenticated user visits `/appointment`
- **THEN** they SHALL be redirected to the login page

#### Scenario: Sidebar nav links

- **WHEN** a user views the appointment sidebar
- **THEN** navigation links to Home, Lists, AI, and Logout SHALL be shown
