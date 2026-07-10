## Requirements

### Requirement: Admin offering form SHALL render per-field validation errors inline

When the admin creates or edits an offering and validation fails, the controller SHALL re-render the page directly (status 400) with `formValues` and `fieldErrors` passed as props, displaying error messages adjacent to the specific field that failed. The route prefix for these operations SHALL be `/verwaltung`.

#### Scenario: Required field is empty

- **WHEN** admin submits the create form with an empty "Tag" (day) field
- **THEN** the controller re-renders the page with status 400
- **AND** the form shows a red border on the day input and an inline error message

#### Scenario: Invalid resource selected

- **WHEN** admin submits the form with an invalid resource_id
- **THEN** the controller re-renders the page with status 400
- **AND** the form shows inline error on the resource select

#### Scenario: Start time after end time

- **WHEN** admin submits the form with start_min=1020 and end_min=480
- **THEN** the controller re-renders the page with status 400
- **AND** the form shows inline error on the end_min select

#### Scenario: Multiple fields fail validation

- **WHEN** admin submits the form with multiple invalid fields
- **THEN** the controller re-renders the page with status 400
- **AND** the form displays each inline error simultaneously

### Requirement: Admin offering form SHALL preserve submitted values on validation failure

When validation fails and the controller re-renders the page, the form SHALL retain all submitted input values so the admin can correct errors without re-entering valid fields. Form values SHALL be passed as `formValues` props, read from raw `FormData` entries.

#### Scenario: Values preserved after single-field error

- **WHEN** admin fills "Tag" with "2026-06-15", selects resource_id=5, and submits with an invalid start_min
- **THEN** the re-rendered form shows "2026-06-15" in the day input and resource_id=5 selected

#### Scenario: Select values preserved

- **WHEN** admin selects resource_id=3 and submits with an invalid day format
- **THEN** the re-rendered form shows resource_id=3 selected in the resource dropdown

### Requirement: Admin offering form SHALL show form-level errors as banner

Business-rule failures that are not field-specific (holiday, past-date, exclusion constraint) SHALL display as a banner at the top of the form. These SHALL be passed as `formError` prop to the page component.

#### Scenario: Public holiday

- **WHEN** admin submits with a date that falls on a German public holiday
- **THEN** a banner shows "Dieses Datum ist ein Feiertag."
- **AND** submitted values are preserved

#### Scenario: Past date

- **WHEN** admin submits with a date in the past
- **THEN** a banner shows "Angebote in der Vergangenheit können nicht erstellt oder bearbeitet werden."

#### Scenario: Exclusion constraint (time overlap)

- **WHEN** admin submits with a time range that overlaps an existing offering
- **THEN** a banner shows "Dieser Zeitraum überschneidet sich mit einem bestehenden Angebot."

### Requirement: Validation type SHALL be reusable across controllers

The `ValidationResult` type (`{ ok: true } | { ok: false, fieldErrors: Record<string, string> }`) SHALL be defined in `app/utils/form-errors.ts` as a shared utility, not duplicated in each controller.

#### Scenario: Multiple controllers use the same type

- **WHEN** any admin controller defines a `validateXForm()` function
- **THEN** it SHALL import `ValidationResult` from `app/utils/form-errors.ts` and return that type

#### Scenario: Helper unwraps fieldErrors

- **WHEN** a controller calls `fieldErrorsFromResult(result)`
- **THEN** it SHALL return `Record<string, string>` on failure or `undefined` on success

### Requirement: Form inputs SHALL apply error styling on validation failure

The shared `input.error` CSS mixin from `app/ui/mixins/input.ts` SHALL be applied to inputs that have a field-level error decoded from `fe_*` URL params.

#### Scenario: Errored input shows red border

- **WHEN** the day input has a field-level error from decoded `fe_day` param
- **THEN** the input element SHALL have the `input.error` mixin applied, rendering a red border

#### Scenario: Valid input shows normal styling

- **WHEN** an input has no field-level error
- **THEN** the input element SHALL use the standard `input.base` mixin without `input.error`
