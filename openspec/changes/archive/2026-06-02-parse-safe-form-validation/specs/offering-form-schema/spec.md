## ADDED Requirements

### Requirement: Offering form schema uses f.object with coerce.number and .refine

The system SHALL define an `offeringSaveSchema` using `f.object()` with `f.field()` wrappers. Each field SHALL use `coerce.number()` for numeric coercion and `.refine()` for domain validation. The `resource_id` field SHALL validate that the coerced number is greater than zero. The `day` field SHALL validate `YYYY-MM-DD` format. The `start_min` and `end_min` fields SHALL validate valid range and 60-minute divisibility. Grid state fields (`_offset`, `_sort`, `_order`, `_filter`) SHALL be `s.defaulted(s.string(), '')`. The schema SHALL be defined in `app/utils/offering-schema.ts` as a named export with no controller dependencies.

#### Scenario: Valid offering form data passes schema

- **WHEN** `parseSafe(offeringSaveSchema, formData)` is called with `resource_id=5`, `day=2026-06-15`, `start_min=480`, `end_min=1020`
- **THEN** `result.success` is `true` with `result.value.resource_id: number`, `result.value.start_min: number`, etc.

#### Scenario: Empty resource_id coerces to validation error

- **WHEN** `parseSafe(offeringSaveSchema, formData)` is called with `resource_id=""`
- **THEN** `result.success` is `false` with an issue for `resource_id` (coerce.number fails on empty string)

#### Scenario: resource_id = 0 fails refine

- **WHEN** `parseSafe(offeringSaveSchema, formData)` is called with `resource_id=0`
- **THEN** `result.success` is `false` with an issue on path `['resource_id']` containing the refine message

#### Scenario: Invalid day format fails refine

- **WHEN** `parseSafe(offeringSaveSchema, formData)` is called with `day="15.06.2026"`
- **THEN** `result.success` is `false` with an issue on path `['day']`

#### Scenario: start_min not divisible by 60 fails refine

- **WHEN** `parseSafe(offeringSaveSchema, formData)` is called with `start_min=30`
- **THEN** `result.success` is `false` with an issue on path `['start_min']`

#### Scenario: end_min less than 60 fails refine

- **WHEN** `parseSafe(offeringSaveSchema, formData)` is called with `end_min=0`
- **THEN** `result.success` is `false` with an issue on path `['end_min']`

### Requirement: Cross-field endMin > startMin check remains manual post-parse

The system SHALL validate `end_min > start_min` as a manual check after `parseSafe` succeeds, NOT as a schema-level `.refine()`. This matches the timeboxer demo pattern where duplicate-username is checked after parseSafe rather than embedded in the schema.

#### Scenario: end_min <= start_min returns field error

- **WHEN** parseSafe succeeds with `end_min=480`, `start_min=480`
- **THEN** the controller SHALL produce a field error `{ end_min: 'muss nach der Startzeit liegen.' }`

### Requirement: Schema file exports field name constants

The system SHALL export `OFFERING_FORM_KEYS` as a `readonly` string array from `app/utils/offering-schema.ts` listing the user-editable field names that are encoded as `fv_*` URL params during redirects.

#### Scenario: Field keys are importable

- **WHEN** a controller imports `OFFERING_FORM_KEYS`
- **THEN** it contains `['resource_id', 'day', 'start_min', 'end_min']`
