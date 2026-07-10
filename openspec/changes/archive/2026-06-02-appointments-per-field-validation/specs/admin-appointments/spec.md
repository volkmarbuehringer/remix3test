## ADDED Requirements

### Requirement: Admin appointment form SHALL render per-field validation errors inline

When the admin creates or edits an appointment and validation fails, the form SHALL display error messages adjacent to the specific field that failed, not only as a form-level banner.

#### Scenario: Required field is empty

- **WHEN** admin submits the create form with an empty "Titel" field
- **THEN** the form is re-rendered with a red border on the title input and an inline message "Titel ist erforderlich."
- **AND** all other previously filled fields retain their submitted values

#### Scenario: Start time after end time

- **WHEN** admin submits the form with start_min=1020 and end_min=480
- **THEN** the form is re-rendered with a red border on the end_min select and an inline message "Endzeit muss nach der Startzeit liegen."

#### Scenario: Multiple fields fail validation

- **WHEN** admin submits the form with multiple empty required fields
- **THEN** each failed field displays its inline error message simultaneously

### Requirement: Admin appointment form SHALL preserve submitted values on validation failure

When validation fails, the form SHALL retain all submitted input values so the admin can correct errors without re-entering valid fields.

#### Scenario: Values preserved after single-field error

- **WHEN** admin fills "Titel" with "Meeting", "Email" with "user@test.com", and submits with an invalid date
- **THEN** "Titel" shows "Meeting" and "Email" shows "user@test.com" after re-render
- **AND** only the date field shows an error

#### Scenario: Select values preserved

- **WHEN** admin selects resource_id=2 and submits with an empty title
- **THEN** the resource dropdown shows resource_id=2 selected in the re-rendered form

### Requirement: Admin appointment form SHALL show form-level errors as banner

Validation failures that are not field-specific (e.g., time slot overlaps, past dates, slot outside offering hours) SHALL continue to display as a banner at the top of the form.

#### Scenario: Time slot overlap

- **WHEN** admin submits with a time range that overlaps an existing appointment
- **THEN** a banner shows "Dieser Zeitraum überschneidet sich mit einem bestehenden Termin."
- **AND** submitted values are preserved

#### Scenario: Past date

- **WHEN** admin submits with a date in the past
- **THEN** a banner shows "Termine in der Vergangenheit können nicht erstellt oder bearbeitet werden."
- **AND** submitted values are preserved

#### Scenario: Slot outside offering hours

- **WHEN** admin submits with a time range outside the resource's bookable hours
- **THEN** a banner shows "Der gewünschte Zeitraum liegt außerhalb der Buchungszeiten."
- **AND** submitted values are preserved

### Requirement: Admin appointment form SHALL apply the existing error CSS mixin on errored inputs

The shared `input.error` CSS mixin from `app/ui/mixins/input.ts` SHALL be applied to inputs that have a field-level error.

#### Scenario: Errored input shows red border

- **WHEN** the title input has a field-level error
- **THEN** the input element SHALL have the `input.error` mixin applied, rendering a red border
