# Self-Service Appointments Page

## Purpose
Provide authenticated non-admin users with a simplified interface to view, create, edit, and delete their own appointments at `/appointments/new`.

## Requirements

### Requirement: User can view their appointments in a simplified table
The system SHALL display an appointments table for the currently authenticated user at `/appointments/new` showing only Titel, Ressource, Datum, and Zeit columns.

#### Scenario: Table shows user's appointments
- **WHEN** user navigates to `/appointments/new`
- **THEN** the page displays a table with columns: Titel, Ressource, Datum, Zeit
- **THEN** only appointments belonging to the authenticated user are shown

#### Scenario: Empty state
- **WHEN** user navigates to `/appointments/new` and has no appointments
- **THEN** the page displays "Keine Termine vorhanden."

### Requirement: User can filter appointments by period
The system SHALL provide period presets (Alle, Diese Woche, Nächste Woche, Diesen Monat, Nächsten Monat).

#### Scenario: Period preset filters by date range
- **WHEN** user clicks "Diese Woche"
- **THEN** the table shows only appointments in the current week

### Requirement: User can sort appointments by columns
The system SHALL allow sorting by Titel, Ressource, Datum, and Zeit.

#### Scenario: Sort by column
- **WHEN** user clicks a column header
- **THEN** the table is sorted by that column ascending
- **WHEN** user clicks the same column header again
- **THEN** the sort direction toggles to descending

### Requirement: User can paginate through appointments
The system SHALL paginate appointments with 15 rows per page.

#### Scenario: Navigate to next page
- **WHEN** user clicks "Weiter"
- **THEN** the table shows the next 15 appointments

### Requirement: Each row has inline action buttons
Each table row SHALL display Bearbeiten and Löschen buttons instead of a right-click context menu.

#### Scenario: Bearbeiten button opens edit panel
- **WHEN** user clicks "Bearbeiten" on a row
- **THEN** the page shows an edit panel on the right with the appointment's current values

#### Scenario: Löschen button deletes with confirmation
- **WHEN** user clicks "Löschen" on a row
- **THEN** the browser shows a confirmation dialog "Wirklich löschen?"
- **WHEN** user confirms
- **THEN** the appointment is deleted and the table refreshes

### Requirement: Create form omits user selection

The system SHALL present a 3-step wizard for creating appointments: (1) select resource, (2) select a day with offerings, (3) select a bookable full-hour time and enter title. The authenticated user's ID SHALL be used automatically.

#### Scenario: Create wizard has no user field
- **WHEN** user clicks "Neu"
- **THEN** the wizard begins at step 1 with a resource dropdown
- **WHEN** user completes all 3 steps
- **THEN** the appointment is created
- **THEN** there is no "Benutzer" dropdown

#### Scenario: Create wizard enforces full-hour slots
- **WHEN** user reaches step 3 of the wizard
- **THEN** the time dropdown shows only `start_min` values that are multiples of 60 and fall within at least one offering for the selected resource+day
- **THEN** the end time is always 1 hour after the start time (no end time selection)

### Requirement: Edit form omits user selection
The edit form SHALL NOT include a user dropdown. The time dropdown SHALL show only full-hour slots that are bookable for the current resource+date.

#### Scenario: Edit form has no user field
- **WHEN** user clicks "Bearbeiten" on a row
- **THEN** the edit form panel shows fields: Ressource, Titel, Datum, Startzeit
- **THEN** there is no "Benutzer" dropdown
- **THEN** the end time is always 1 hour after the start time (no end time selection)

#### Scenario: Edit form shows filtered time slots
- **WHEN** user clicks "Bearbeiten" on a row
- **THEN** the edit form panel shows fields: Ressource, Titel, Datum, Startzeit
- **THEN** the Startzeit dropdown contains only `start_min` values that are multiples of 60 and fall within at least one offering for the appointment's resource+date
- **THEN** the currently booked time is always included even if it falls outside current offerings
