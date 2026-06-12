## ADDED Requirements

### Requirement: Admins can export users filtered by appointment date range
The system SHALL provide a page at `/verwaltung/users-export` where admins can select a time range and download a PDF of users who had appointments within that range.

#### Scenario: Page loads with empty filter form
- **WHEN** an admin navigates to `/verwaltung/users-export`
- **THEN** the system SHALL display a form with start date and end date inputs (empty by default) and a submit button

#### Scenario: Admin exports users within a valid date range
- **WHEN** an admin enters start date "2026-01-01" and end date "2026-03-31" and clicks submit
- **THEN** the system SHALL query for users with at least one appointment WHERE `date >= 1767225600000` AND `date < 1775116800000`
- **THEN** the system SHALL return a PDF attachment with filename `benutzer-export-2026-01-01_2026-03-31.pdf`

#### Scenario: No users found in the selected range
- **WHEN** an admin selects a date range that has no appointments
- **THEN** the system SHALL not generate a PDF
- **THEN** the system SHALL re-render the form with an error message "Keine Benutzer mit Terminen im gewählten Zeitraum gefunden."

#### Scenario: Only users with appointments in the range are included
- **WHEN** an admin exports with a date range
- **THEN** the PDF SHALL only list users who have at least one appointment where `appointments.date` falls within `[startMs, endMs)`
- **THEN** the appointment statistics (count, total minutes, first/last date) SHALL be scoped to that same range

#### Scenario: Non-admin users are denied access
- **WHEN** a non-admin user navigates to `/verwaltung/users-export`
- **THEN** the system SHALL deny access (same as other admin routes)

#### Scenario: Missing date fields show validation error
- **WHEN** an admin submits the form without entering a start date or end date
- **THEN** the system SHALL re-render the form with an error message "Bitte Start- und Enddatum auswählen."

### Requirement: Dashboard card links to the export page
The `/verwaltung` overview page SHALL show a card linking to `/verwaltung/users-export`.

#### Scenario: Dashboard card is visible
- **WHEN** an admin views the `/verwaltung` page
- **THEN** the system SHALL display a card titled "Benutzer-Export (gefiltert)" with a link to `/verwaltung/users-export`
