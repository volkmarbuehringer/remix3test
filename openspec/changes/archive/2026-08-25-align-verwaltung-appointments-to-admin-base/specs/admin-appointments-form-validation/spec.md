## MODIFIED Requirements

### Requirement: Admin appointments form SHALL render per-field validation errors inline

When the admin creates or edits an appointment and validation fails, the controller SHALL re-render the page directly (status 200) with `formValues` and `fieldErrors` passed as props through `loadAppointmentPageData()`, displaying error messages adjacent to the specific field that failed. The controller SHALL NOT issue a 302 redirect with URL-encoded error state and SHALL NOT use a non-OK (400/500) response to deliver the validation-failure re-render.

#### Scenario: Required field is empty

- **WHEN** admin submits the create form with an empty title field
- **THEN** the controller re-renders the page with status 200
- **AND** the form shows an inline error message next to the title input

#### Scenario: Schema validation failure

- **WHEN** admin submits the form with a title that exceeds the maximum length
- **THEN** the controller re-renders the page with status 200
- **AND** the form shows an inline error message next to the title input

#### Scenario: Cross-field validation failure (end after start)

- **WHEN** admin submits the form with start_min=1020 and end_min=480
- **THEN** the controller re-renders the page with status 200
- **AND** the form shows an inline error on the end_min input

#### Scenario: Multiple fields fail validation

- **WHEN** admin submits the form with multiple invalid fields (empty title, invalid date)
- **THEN** the controller re-renders the page with status 200
- **AND** the form displays each inline error simultaneously

#### Scenario: Slot not bookable

- **WHEN** admin submits with a time range that falls outside the resource's bookable offering hours
- **THEN** the controller re-renders the page with status 200
- **AND** a `formErrorBanner` inside the form shows "Der gewünschte Zeitraum liegt außerhalb der Buchungszeiten."
- **AND** submitted values are preserved

#### Scenario: Exclusion constraint (time overlap)

- **WHEN** admin submits with a time range that overlaps an existing appointment
- **THEN** the controller re-renders the page with status 200
- **AND** a `formErrorBanner` inside the form shows "Dieser Zeitraum überschneidet sich mit einem bestehenden Termin."
- **AND** submitted values are preserved

#### Scenario: Rate limit exceeded

- **WHEN** admin submits too many create requests in rapid succession
- **THEN** the controller re-renders the page with status 200
- **AND** a `formErrorBanner` inside the form shows "Bitte warten Sie, bevor Sie einen weiteren Termin anlegen."
- **AND** the form remains in creation mode

### Requirement: Form error SHALL NOT render at page level when a form panel is active

The `formError` prop SHALL render only inside the form panel component, not at the page level above the table. The `AdminAppointmentsPage` SHALL only show `error` (from the index `?error=` URL path) when `!hasFormPanel`. Non-field mutation errors (invalid/not-found id, delete blocked by a foreign-key constraint) SHALL surface via `session.flash` and the shared `verwaltung` flash banner rather than a page-level `error` banner. The `show` GET `/:id` route SHALL NOT render a page-level "Eintrag nicht gefunden." error for a deleted/missing row — it SHALL redirect (Post/Redirect/Get) back to the grid. The `AdminOfferingsPage` SHALL apply the same pattern — `formError` at page level SHALL be gated behind `!hasFormPanel` to avoid double-rendering the error message.

#### Scenario: Form panel active — formError only in form

- **WHEN** the page renders with `creating=true` and `formError="Invalid input"`
- **THEN** `AdminAppointmentsPage` does NOT render `formError` at page level
- **AND** the `AdminAppointmentsForm` renders `formError` inside the form panel
- **AND** the error message appears exactly once

#### Scenario: Page-level error shown only from the index URL-error path

- **WHEN** the index page renders with `error` set (from a `?error=` URL) and no form panel active
- **THEN** `AdminAppointmentsPage` renders `error` at page level using `table.errorBanner`
- **AND** no form panel is rendered

#### Scenario: GET /:id for a missing row redirects to the grid

- **WHEN** the frame GETs `/:id` for a deleted or missing appointment
- **THEN** the `show` route redirects (3xx) to the grid list
- **AND** no "Eintrag nicht gefunden." page-level error is rendered

#### Scenario: Mutation block surfaces via flash, not a page banner

- **WHEN** a destroy or update is blocked (invalid id, not-found row, or a delete blocked by a constraint)
- **THEN** the controller redirects back to the grid and the message surfaces via `session.flash` in the shared `verwaltung` flash banner
- **AND** the page-level `error` banner is not used for the mutation result
