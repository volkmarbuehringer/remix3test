## ADDED Requirements

### Requirement: Users PDF exports at /verwaltung/users-pdf

The system SHALL provide a PDF download endpoint at `/verwaltung/users-pdf` accessible only to authenticated admin users. The endpoint SHALL return a PDF file containing a table with one row per user account and a per-user appointment summary.

#### Scenario: Admin downloads users PDF
- **WHEN** an authenticated admin user navigates to `/verwaltung/users-pdf`
- **THEN** the server returns a PDF document with Content-Type `application/pdf`
- **AND** the Content-Disposition header SHALL include `attachment` with a filename containing the current date

#### Scenario: PDF contains all user accounts
- **WHEN** an admin downloads the users PDF
- **THEN** the PDF SHALL contain a table with columns: Name, E-Mail, Termine (count), Gesamtzeit (HH:MM), Erster Termin, Letzter Termin
- **AND** every user account in the database SHALL appear as one row

#### Scenario: Users with no appointments
- **WHEN** a user has zero appointments
- **THEN** the Termine column SHALL show `0`
- **AND** the Gesamtzeit, Erster Termin, and Letzter Termin columns SHALL show `—`

#### Scenario: Unauthenticated user is redirected
- **WHEN** an unauthenticated user navigates to `/verwaltung/users-pdf`
- **THEN** the server SHALL redirect to the login page

#### Scenario: Non-admin user gets 403
- **WHEN** an authenticated non-admin user navigates to `/verwaltung/users-pdf`
- **THEN** the server SHALL return a 403 Forbidden response

#### Scenario: Frame redirect to full page
- **WHEN** a request is made with the `X-Remix-Frame` header set to `true`
- **THEN** the server SHALL redirect (302) to the same URL without the frame header for proper PDF download

### Requirement: PDF document metadata

The PDF SHALL include a title header "Benutzerübersicht" with the current date as a subtitle, and a footer line showing the total number of users listed.

#### Scenario: PDF header display
- **WHEN** the PDF is generated
- **THEN** the first page SHALL show "Benutzerübersicht" as the main title
- **AND** the current date SHALL appear as a subtitle
- **AND** the total user count SHALL appear below the subtitle

#### Scenario: PDF uses light table style
- **WHEN** the PDF table is rendered
- **THEN** the table SHALL use the `lightHorizontalLines` layout to match the existing PDF style
