## Purpose

Provides authenticated admins a date-filtered PDF export of all users with appointments at `/verwaltung/users-export`, with a shareable GET download, validated calendar dates, a UTC-day window convention, and friendly empty/validation states.

## Requirements

### Requirement: Users export form page

The system SHALL render a form page at `/verwaltung/users-export` (GET, no query params) where an admin can choose a start and end date and trigger the export. The form SHALL submit as a native document navigation (opting out of frame interception) so the download response reaches the browser's download manager. Access SHALL be restricted to authenticated admin users.

#### Scenario: Admin opens the export page

- **WHEN** an authenticated admin user navigates to `/verwaltung/users-export`
- **THEN** the server returns a 200 HTML page with a start-date and end-date input and an export submit button
- **AND** the form is marked as a native document navigation (`data-rmx-document`)

#### Scenario: Unauthenticated user is redirected

- **WHEN** an unauthenticated user navigates to `/verwaltung/users-export`
- **THEN** the server SHALL redirect to the login page

#### Scenario: Non-admin user gets 403

- **WHEN** an authenticated non-admin user requests the export page or download
- **THEN** the server SHALL return a 403 Forbidden response

### Requirement: Date-filtered PDF download via POST and GET

The system SHALL produce a PDF download of all users with at least one appointment in the selected date range, reachable both by POST form submission (CSRF-protected) and by GET with `startDate` and `endDate` query parameters so a chosen range is bookmarkable and shareable.

#### Scenario: POST download

- **WHEN** an admin submits the form via POST with valid `startDate` and `endDate`
- **THEN** the server returns a PDF with Content-Type `application/pdf` and Content-Disposition `attachment` with a filename containing the selected dates

#### Scenario: GET download with query parameters

- **WHEN** an admin navigates to `/verwaltung/users-export?startDate=2026-01-01&endDate=2026-01-31`
- **THEN** the server returns the same PDF download as the equivalent POST

#### Scenario: PDF contains per-user summary for the range

- **WHEN** an admin downloads the export for a date range
- **THEN** the PDF SHALL contain a table with columns Name, E-Mail, Termine (count), Gesamtzeit (HH:MM), Erster Termin, Letzter Termin
- **AND** one row SHALL appear per user with at least one appointment whose date falls in the range
- **AND** a header SHALL show the title "Benutzer-Export" and the selected period, and a line SHALL state the total user count

### Requirement: Calendar-valid date inputs

The system SHALL accept only real calendar dates in `YYYY-MM-DD` format for both start and end date; values that do not parse to an existing calendar date SHALL be rejected with a per-field validation error.

#### Scenario: Non-calendar date is rejected

- **WHEN** `startDate` is `2024-02-31`
- **THEN** the server responds with status 400
- **AND** re-renders the form page with the submitted values preserved
- **AND** shows a validation error assigned to the `startDate` field, not a generic single error

#### Scenario: End date must be after start date

- **WHEN** the submitted end date is not after the start date
- **THEN** the server responds with status 400 and shows a range error, preserving both values

### Requirement: UTC-day export window

The system SHALL interpret the selected date range as UTC calendar days: the query window SHALL span from start-date UTC midnight (inclusive) to end-date UTC midnight plus one day (exclusive), and the rendered period labels SHALL be derived from the same UTC interpretation, so the queried window always matches the displayed "Zeitraum" label.

#### Scenario: Label matches queried window

- **WHEN** an admin exports the range `2026-01-01` to `2026-01-31`
- **THEN** the query window SHALL be `2026-01-01T00:00:00Z` (inclusive) to `2026-02-01T00:00:00Z` (exclusive)
- **AND** the PDF subtitle SHALL display "1. Januar 2026 – 31. Januar 2026"

### Requirement: Empty result renders as neutral empty state

The system SHALL respond to a valid range with no matching users by re-rendering the form page with status 200 and a neutral informational message, not an error banner and not a 404 status.

#### Scenario: No users in range

- **WHEN** the selected range contains no users with appointments
- **THEN** the server responds with status 200
- **AND** the form page shows a neutral notice that no users were found, with the form values preserved

### Requirement: Frame download shim

The system SHALL let PDF downloads initiated from inside the verwaltung frame shell complete as full-page downloads. Because frame fetches re-send `X-Remix-Frame: true` when following redirects, the download path SHALL redirect framed requests to a marker URL whose request terminates the chain with an HTML page render; the frame client then performs a full-page navigation to the marker URL, where the download runs without frame headers.

#### Scenario: In-frame download escapes to a full page

- **WHEN** the export download is requested with the `X-Remix-Frame` header set to `true`
- **THEN** the server returns a 302 redirect to the same URL plus a marker query parameter
- **AND** a request to the marker URL carrying `X-Remix-Frame` renders the form page as HTML (status 200) instead of redirecting, so the redirect chain terminates
- **AND** a full-page (non-frame) request to the marker URL performs the PDF download

### Requirement: PDF generation errors are logged

The system SHALL log errors thrown during export generation via the request logger before returning the 500 response.

#### Scenario: Generation failure is logged

- **WHEN** PDF generation or the underlying query throws
- **THEN** the error SHALL be logged via the request-scoped logger
- **AND** the server returns a 500 response with a German error message
