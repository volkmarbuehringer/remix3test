## ADDED Requirements

### Requirement: Appointment form schema uses f.object with coerce.number and .refine

The system SHALL define an `appointmentSaveSchema` using `f.object()` with `f.field()` wrappers. Each numeric field SHALL use `coerce.number()` for coercion and `.refine()` for domain validation. Text fields SHALL use `s.string()` with `.refine()` for format/length checks. Grid state fields SHALL use `s.defaulted(s.string(), '')`. The schema SHALL be defined in `app/utils/appointment-schema.ts` with no controller dependencies.

#### Scenario: Valid appointment form data passes schema
- **WHEN** `parseSafe(appointmentSaveSchema, formData)` is called with all valid fields
- **THEN** `result.success` is `true` with coerced numeric values for `resource_id`, `user_id`, `start_min`, `end_min`

#### Scenario: Empty resource_id fails
- **WHEN** `parseSafe(appointmentSaveSchema, formData)` is called with `resource_id=""`
- **THEN** `result.success` is `false` with issue on path `['resource_id']`

#### Scenario: Empty user_id fails
- **WHEN** `parseSafe(appointmentSaveSchema, formData)` is called with `user_id=""`
- **THEN** `result.success` is `false` with issue on path `['user_id']`

#### Scenario: Empty title fails refine
- **WHEN** `parseSafe(appointmentSaveSchema, formData)` is called with `title=""` or `title="  "`
- **THEN** `result.success` is `false` with issue on path `['title']`

#### Scenario: Invalid date format fails
- **WHEN** `parseSafe(appointmentSaveSchema, formData)` is called with `date="15.06.2026"`
- **THEN** `result.success` is `false` with issue on path `['date']`

#### Scenario: start_min not divisible by 15 fails refine
- **WHEN** `parseSafe(appointmentSaveSchema, formData)` is called with `start_min=10`
- **THEN** `result.success` is `false` with issue on path `['start_min']`

### Requirement: Appointment form schema exports field name constants

The system SHALL export `APPOINTMENT_FORM_KEYS` as a `readonly` string array from `app/utils/appointment-schema.ts` listing user-editable field names for `fv_*` URL param encoding.

#### Scenario: Field keys are importable
- **WHEN** a controller imports `APPOINTMENT_FORM_KEYS`
- **THEN** it contains `['resource_id', 'user_id', 'title', 'date', 'start_min', 'end_min']`

### Requirement: Cross-field and business rules remain manual post-parse

The system SHALL validate `end_min > start_min` as a manual post-parse check in the controller. Business rules (past-date, slot bookability, exclusion constraints) SHALL remain as controller-level checks after successful schema parsing, matching the timeboxer demo's pattern for domain validations that require external data.

#### Scenario: end_min <= start_min after successful parse
- **WHEN** parseSafe succeeds but `end_min` is not greater than `start_min`
- **THEN** controller produces field error `{ end_min: 'muss nach der Startzeit liegen.' }`

#### Scenario: Business rule failure does not produce schema issue
- **WHEN** a business rule fails (past date, slot not bookable, exclusion constraint)
- **THEN** the error is handled by the controller, not by the schema
