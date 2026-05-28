## Purpose

How appointments are created, displayed, updated, and deleted in the weekly calendar view.

## Requirements

### Requirement: Overlap prevention

The system SHALL prevent overlapping appointments at the database level using a PostgreSQL exclusion constraint on the `during` range column.

#### Scenario: Constraint on table

- **WHEN** the server starts
- **THEN** the `appointments` table SHALL have a `CONSTRAINT no_overlapping_seats EXCLUDE USING GIST (date WITH =, during WITH &&)` preventing overlapping ranges on the same day (no double booking)

#### Scenario: Overlapping insert rejected

- **WHEN** an INSERT or UPDATE would create an appointment whose `during` range overlaps with an existing row
- **THEN** PostgreSQL SHALL reject the write with an exclusion constraint violation error

#### Scenario: Non-overlapping insert succeeds

- **WHEN** an INSERT or UPDATE creates an appointment whose `during` range does NOT overlap any existing row
- **THEN** the write SHALL succeed

### Requirement: Appointments table

The system SHALL store appointments in an `appointments` PostgreSQL table.

#### Scenario: Table auto-created on startup

- **WHEN** the server starts
- **THEN** the `appointments` table SHALL exist with columns: `id` (integer PK), `user_id` (FK → users), `title` (text, required), `date` (bigint, required), `created_at` (bigint), `updated_at` (bigint), `during` (int4range, required), `start_min` (integer, GENERATED ALWAYS AS lower(during) STORED), `end_min` (integer, GENERATED ALWAYS AS upper(during) STORED)

#### Scenario: New appointment created

- **WHEN** a user creates an appointment
- **THEN** it SHALL be stored with `during` derived from the provided `start_min` and `end_min` values
- **THEN** `created_at` and `updated_at` SHALL be set to the current time

#### Scenario: Appointment updated

- **WHEN** a user updates an appointment
- **THEN** `updated_at` SHALL be updated to the current time
- **THEN** if `start_min` or `end_min` is provided, `during` SHALL be recomputed from the new values

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

The system SHALL display a 7-column weekly grid showing appointments for each day of the selected week. When viewed by a non-admin user, blocks belonging to other users SHALL render without title text or hover tooltip.

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

#### Scenario: Foreign block renders without title for non-admin

- **WHEN** a non-admin user views the grid
- **AND** the grid contains appointments belonging to other users
- **THEN** those appointment blocks SHALL render as a colored area without title text
- **AND** those blocks SHALL NOT show a hover tooltip
- **AND** the block SHALL have `cursor: default`

#### Scenario: Foreign block renders with full details for admin

- **WHEN** an admin user views the grid
- **AND** the grid contains appointments belonging to other users
- **THEN** those appointment blocks SHALL render with full title text and details
- **AND** the admin SHALL be able to interact with those blocks (drag, resize, edit, delete)

### Requirement: Create appointment

The system SHALL allow users to create new appointments by clicking on an empty time slot, provided the appointment date is not in the past.

#### Scenario: Click empty slot

- **WHEN** a user clicks an empty time slot in the grid
- **THEN** a draft appointment block SHALL appear at that position

#### Scenario: Name the appointment

- **WHEN** a draft block appears
- **THEN** the user SHALL be able to type a title and press Enter to commit

#### Scenario: Save to server

- **WHEN** a user commits a new appointment
- **THEN** the system SHALL POST the new appointment to the server and display it in the grid

#### Scenario: Past date rejected

- **WHEN** a user commits a new appointment on a date before today (UTC)
- **THEN** the system SHALL reject the write
- **AND** the system SHALL display error message `"Termine in der Vergangenheit können nicht erstellt oder bearbeitet werden."`
- **AND** the appointment SHALL NOT be created

### Requirement: Update appointment

The system SHALL allow users to update appointments, provided their own appointments are updated no fewer than 24 hours before the scheduled start time. Admin users MAY update any appointment regardless of time or ownership.

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

#### Scenario: Update blocked within 24h of start

- **WHEN** a non-admin user attempts to update an appointment
- **AND** the scheduled start time (`date + start_min`) is fewer than 24 hours from the current server time (UTC)
- **THEN** the system SHALL reject the write
- **AND** the system SHALL display error message `"Termine können nur bis 24 Stunden vor Beginn bearbeitet werden."`
- **AND** the appointment SHALL NOT be updated

#### Scenario: Update allowed 24h+ before start

- **WHEN** a non-admin user attempts to update an appointment
- **AND** the scheduled start time is at least 24 hours from the current server time (UTC)
- **THEN** the system SHALL allow the update (subject to other validation rules)

#### Scenario: Admin updates any appointment at any time

- **WHEN** an admin user attempts to update any appointment (own or foreign, any start time)
- **THEN** the system SHALL allow the update (subject to other validation rules)

### Requirement: Delete appointment

The system SHALL allow users to delete appointments. Appointments may be deleted no fewer than 24 hours before the scheduled start time. Admin users MAY delete any appointment regardless of time or ownership.

#### Scenario: Delete via block button

- **WHEN** a user hovers over an appointment block
- **THEN** a delete button SHALL appear on hover

#### Scenario: Confirm delete

- **WHEN** a user clicks the delete button
- **THEN** the appointment SHALL be deleted from the server and removed from the grid

#### Scenario: Delete blocked within 24h of start

- **WHEN** a non-admin user attempts to delete an appointment
- **AND** the scheduled start time (`date + start_min`) is fewer than 24 hours from the current server time (UTC)
- **THEN** the system SHALL reject the deletion
- **AND** the system SHALL display error message `"Termine können nur bis 24 Stunden vor Beginn gelöscht werden."`
- **AND** the appointment SHALL NOT be deleted

#### Scenario: Delete allowed 24h+ before start

- **WHEN** a non-admin user attempts to delete an appointment
- **AND** the scheduled start time is at least 24 hours from the current server time (UTC)
- **THEN** the system SHALL allow the deletion

#### Scenario: Admin deletes any appointment at any time

- **WHEN** an admin user attempts to delete any appointment (own or foreign, any start time)
- **THEN** the system SHALL allow the deletion

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

### Requirement: Create appointment from type

The system SHALL allow users to create a new appointment by dragging a type from the types panel onto the calendar grid.

#### Scenario: Drag type onto grid

- **WHEN** a user pointer-downs on a type item in the types panel and drags it over the calendar grid
- **THEN** a ghost block SHALL appear at the snapped time slot showing where the appointment will land

#### Scenario: Ghost block shows 60 min

- **WHEN** a type is being dragged over the grid
- **THEN** the ghost block SHALL span 60 minutes from the snapped start time

#### Scenario: Drop creates appointment

- **WHEN** a user releases the pointer over a valid time slot
- **THEN** the system SHALL POST to `/appointment` with the `typeId`, `date`, and `start_min`
- **THEN** the server SHALL perform `INSERT INTO appointments(...) SELECT ... FROM appointtypes WHERE id = :typeId AND user_id = :authUserId` using `int4range()`
- **THEN** the page SHALL reload to show the new appointment

#### Scenario: Drop outside grid cancels

- **WHEN** a user releases the pointer outside the grid bounds
- **THEN** no appointment SHALL be created and the ghost block SHALL disappear

#### Scenario: Type from another user rejected

- **WHEN** a typeId references a type belonging to a different user
- **THEN** the INSERT...SELECT SHALL return zero rows and the server SHALL return a 404 error

#### Scenario: Type deleted between drag and drop

- **WHEN** a user starts dragging a type but another session deletes it before the drop
- **THEN** the INSERT...SELECT SHALL return zero rows and the server SHALL return a 404 error

### Requirement: Create type from appointment

The system SHALL allow users to create a new appointment type by dragging an appointment block onto the types panel.

#### Scenario: Drag onto types panel

- **WHEN** a user drags an appointment block over the types panel
- **THEN** the types panel SHALL show a visual drop zone highlight

#### Scenario: Drop creates type

- **WHEN** a user drops an appointment block onto the types panel
- **THEN** the system SHALL POST the appointment title to `/appointment/types`
- **THEN** a new type SHALL be created with that title

#### Scenario: Appointment stays unchanged

- **WHEN** a user drops an appointment block onto the types panel
- **THEN** the appointment SHALL remain in its original position (copy, not move)

#### Scenario: Drop outside types panel cancels

- **WHEN** a user releases the pointer outside the types panel
- **THEN** no type SHALL be created
- **THEN** the existing move/resize behavior SHALL apply as normal

### Requirement: Admin can update any appointment via user-facing controller

The system SHALL allow admin users to update appointments belonging to any user through the user-facing API endpoint at `/appointment/:id`.

#### Scenario: Admin PUT /appointment/:id for foreign appointment succeeds

- **WHEN** an admin user sends a PUT request to `/appointment/:id` for an appointment belonging to another user
- **THEN** the system SHALL update the appointment
- **AND** the response SHALL include the updated appointment data

#### Scenario: Non-admin PUT /appointment/:id for foreign appointment fails

- **WHEN** a non-admin user sends a PUT request to `/appointment/:id` for an appointment belonging to another user
- **THEN** the system SHALL return a 404 error

### Requirement: Admin can delete any appointment via user-facing controller

The system SHALL allow admin users to delete appointments belonging to any user through the user-facing API endpoint at `/appointment/:id`.

#### Scenario: Admin DELETE /appointment/:id for foreign appointment succeeds

- **WHEN** an admin user sends a DELETE request to `/appointment/:id` for an appointment belonging to another user
- **THEN** the system SHALL delete the appointment
- **AND** the response SHALL include `{ deleted: true }`

#### Scenario: Non-admin DELETE /appointment/:id for foreign appointment fails

- **WHEN** a non-admin user sends a DELETE request to `/appointment/:id` for an appointment belonging to another user
- **THEN** the system SHALL return a 404 error
