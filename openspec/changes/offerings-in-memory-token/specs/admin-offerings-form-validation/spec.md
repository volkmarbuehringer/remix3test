## ADDED Requirements

### Requirement: Admin offering form SHALL render per-field validation errors inline

When the admin creates or edits an offering and validation fails, the form SHALL display error messages adjacent to the specific field that failed. The controller SHALL re-render the page from POST (not redirect), following the Remix 3 `timeboxer` demo pattern.

#### Scenario: Required field is empty
- **WHEN** admin submits the create form with an empty "Tag" (day) field
- **THEN** the form is re-rendered with a red border on the day input and an inline message "Gültiges Datum erforderlich (YYYY-MM-DD)."
- **AND** all other previously filled fields retain their submitted values

#### Scenario: Invalid resource selected
- **WHEN** admin submits the form with resource_id=0
- **THEN** the form is re-rendered with a red border on the resource select and an inline message "ist erforderlich."

#### Scenario: Multiple fields fail validation
- **WHEN** admin submits the form with multiple empty required fields
- **THEN** each failed field displays its inline error message simultaneously

### Requirement: Admin offering form SHALL preserve submitted values on validation failure

When validation fails and the controller re-renders from POST, the form SHALL retain all submitted input values. Form values SHALL be read directly from `context.formData`, not from URL query parameters.

#### Scenario: Values preserved after single-field error
- **WHEN** admin fills "Tag" with "2026-06-15", selects resource_id=5, and submits with an invalid start_min
- **THEN** the form is re-rendered with "Tag" showing "2026-06-15", the resource select showing resource_id=5

#### Scenario: Select values preserved
- **WHEN** admin selects resource_id=3 and submits with an invalid day format
- **THEN** the resource dropdown shows resource_id=3 selected in the re-rendered form

### Requirement: Admin offering form SHALL show form-level errors as banner

Business-rule failures that are not field-specific (holiday, past-date, exclusion constraint) SHALL display as a banner at the top of the form using 302 redirect with `?error=`.

#### Scenario: Public holiday
- **WHEN** admin submits with a date that falls on a German public holiday
- **THEN** a banner shows "Dieses Datum ist ein Feiertag."

#### Scenario: Past date
- **WHEN** admin submits with a date in the past
- **THEN** a banner shows "Angebote in der Vergangenheit können nicht erstellt oder bearbeitet werden."

#### Scenario: Exclusion constraint
- **WHEN** admin submits with a time range that overlaps an existing offering
- **THEN** a banner shows "Dieser Zeitraum überschneidet sich mit einem bestehenden Angebot."

### Requirement: Validation type SHALL be reusable across controllers

The `ValidationResult` type SHALL be defined in `app/utils/form-errors.ts` as a shared utility.

#### Scenario: Multiple controllers use the same type
- **WHEN** any admin controller defines a `validateXForm()` function
- **THEN** it SHALL import `ValidationResult` from `app/utils/form-errors.ts`

#### Scenario: Helper unwraps fieldErrors
- **WHEN** a controller calls `fieldErrorsFromResult(result)`
- **THEN** it SHALL return `Record<string, string>` on failure or `undefined` on success

### Requirement: Form inputs SHALL apply error styling on validation failure

The shared `input.error` CSS mixin SHALL be applied to inputs that have a field-level error.

#### Scenario: Errored input shows red border
- **WHEN** the day input has a field-level error
- **THEN** the input element SHALL have the `input.error` mixin applied
