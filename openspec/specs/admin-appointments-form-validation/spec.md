## ADDED Requirements

### Requirement: Admin appointments form SHALL render per-field validation errors inline

When the admin creates or edits an appointment and validation fails, the controller SHALL re-render the page directly (status 400) with `formValues` and `fieldErrors` passed as props through `loadAppointmentPageData()`, displaying error messages adjacent to the specific field that failed. The controller SHALL NOT issue a 302 redirect with URL-encoded error state.

#### Scenario: Required field is empty
- **WHEN** admin submits the create form with an empty title field
- **THEN** the controller re-renders the page with status 400
- **AND** the form shows an inline error message next to the title input

#### Scenario: Schema validation failure
- **WHEN** admin submits the form with a title that exceeds the maximum length
- **THEN** the controller re-renders the page with status 400
- **AND** the form shows an inline error message next to the title input

#### Scenario: Cross-field validation failure (end after start)
- **WHEN** admin submits the form with start_min=1020 and end_min=480
- **THEN** the controller re-renders the page with status 400
- **AND** the form shows an inline error on the end_min input

#### Scenario: Multiple fields fail validation
- **WHEN** admin submits the form with multiple invalid fields (empty title, invalid date)
- **THEN** the controller re-renders the page with status 400
- **AND** the form displays each inline error simultaneously

### Requirement: Admin appointments form SHALL preserve submitted values on validation failure

When validation fails and the controller re-renders the page, the form SHALL retain all submitted input values so the admin can correct errors without re-entering valid fields. Form values SHALL be read via `readFormFieldValues(APPOINTMENT_FORM_KEYS, formData)` and passed as `formValues` props.

#### Scenario: Values preserved after single-field error
- **WHEN** admin fills title="Test", selects user_id=3, resource_id=5, date="2026-06-15", and submits with an invalid start_min
- **THEN** the re-rendered form shows "Test" in the title input, user_id=3 selected, resource_id=5 selected, and "2026-06-15" in the date input

#### Scenario: Select values preserved
- **WHEN** admin selects resource_id=3 and submits with an invalid title
- **THEN** the re-rendered form shows resource_id=3 selected in the resource dropdown

#### Scenario: Values preserved during update
- **WHEN** admin edits an existing appointment and submits with an invalid field
- **THEN** the re-rendered form preserves all submitted values and remains in edit mode for the same appointment

### Requirement: Form error SHALL NOT render at page level when a form panel is active

The `formError` prop SHALL render only inside the form panel component, not at the page level above the table. The `AdminAppointmentsPage` SHALL only show `error` (from URL/destroy flow) when `!hasFormPanel`. The `AdminOfferingsPage` SHALL apply the same pattern — `formError` at page level SHALL be gated behind `!hasFormPanel` to avoid double-rendering the error message.

#### Scenario: Form panel active — formError only in form
- **WHEN** the page renders with `creating=true` and `formError="Invalid input"`
- **THEN** `AdminAppointmentsPage` does NOT render `formError` at page level
- **AND** the `AdminAppointmentsForm` renders `formError` inside the form panel
- **AND** the error message appears exactly once

#### Scenario: No form panel — page-level error shown
- **WHEN** the page renders with `error="Eintrag nicht gefunden."` and no form panel active
- **THEN** `AdminAppointmentsPage` renders `error` at page level using `table.errorBanner`
- **AND** no form panel is rendered

#### Scenario: Offerings page — formError not duplicated
- **WHEN** `AdminOfferingsPage` renders with `creating=true` and `formError="Invalid"`
- **THEN** `formError` does NOT appear at page level (line 120 is gated by `!hasFormPanel`)
- **AND** `formError` appears only inside the form panel

#### Scenario: Form error shown only in form panel
- **WHEN** the page has a form panel active (creating or editing) and a `formError` is set
- **THEN** the error banner SHALL appear inside the form panel with transparent danger background and border
- **AND** the error SHALL NOT appear at the page level above the table

#### Scenario: Page-level error shown when no form panel
- **WHEN** no form panel is active and an `error` is set (e.g., from destroy redirect)
- **THEN** the error SHALL appear at the page level above the table using `table.errorBanner`
- **AND** no form-level banner is rendered (no form panel to show it in)

#### Scenario: Past date
- **WHEN** admin submits with a date that is in the past
- **THEN** a `formErrorBanner` inside the form shows "Termine in der Vergangenheit können nicht erstellt oder bearbeitet werden."
- **AND** submitted values are preserved

#### Scenario: Slot not bookable
- **WHEN** admin submits with a time range that falls outside the resource's bookable offering hours
- **THEN** a `formErrorBanner` inside the form shows "Der gewünschte Zeitraum liegt außerhalb der Buchungszeiten."
- **AND** submitted values are preserved

#### Scenario: Exclusion constraint (time overlap)
- **WHEN** admin submits with a time range that overlaps an existing appointment
- **THEN** a `formErrorBanner` inside the form shows "Dieser Zeitraum überschneidet sich mit einem bestehenden Termin."
- **AND** submitted values are preserved

#### Scenario: Rate limit exceeded
- **WHEN** admin submits too many create requests in rapid succession
- **THEN** a `formErrorBanner` inside the form shows "Bitte warten Sie, bevor Sie einen weiteren Termin anlegen."
- **AND** the form remains in creation mode

### Requirement: Admin appointments form SHALL no longer encode form state in URL parameters

The controller SHALL NOT call `encodeFormValues`, `decodeFormValues`, `encodeFieldErrors`, or `decodeFieldErrors`. The `form-params.ts` utility SHALL be removed after migration. The `loadAppointmentPageData()` function SHALL accept `formValues` and `fieldErrors` only via the `overrides` parameter, not from URL query parameters.

#### Scenario: No fv_ or fe_ URL parameters on error
- **WHEN** validation fails during create
- **THEN** the response URL SHALL NOT contain `fv_` or `fe_` query parameters

#### Scenario: Props are the sole source of form state
- **WHEN** `loadAppointmentPageData()` is called without `formValues` override
- **THEN** `formValues` SHALL be `undefined`, not decoded from URL parameters

#### Scenario: form-params.ts is deleted
- **WHEN** the migration is complete
- **THEN** `app/utils/form-params.ts` SHALL NOT exist in the codebase

### Requirement: Admin appointments create and update SHALL use gridStateFromFormData

The create and update actions SHALL extract grid state using `gridStateFromFormData(formData)` and its typed extractor functions (`gridStateOffset`, `gridStateSort`, `gridStateDirection`, `gridStateFilter`) instead of manually destructuring `_offset`, `_sort`, `_order`, and `_filter` from `FormData`.

#### Scenario: Grid state extracted via shared helper
- **WHEN** the create action receives form data with hidden grid state inputs
- **THEN** it SHALL call `gridStateFromFormData(formData)` and use extractor functions to get offset, sort, direction, and filter values

#### Scenario: Grid state preserved on redirect after success
- **WHEN** the create or update action succeeds
- **THEN** the redirect URL SHALL include grid state parameters (offset, sort, order, filter) for index page rendering
