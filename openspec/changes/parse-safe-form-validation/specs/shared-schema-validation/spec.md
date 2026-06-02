## ADDED Requirements

### Requirement: issuesToFieldErrors maps parseSafe issues to per-field error records

The system SHALL provide a shared `issuesToFieldErrors(issues)` utility that maps a `parseSafe` issues array to a `Record<string, string>` where keys are field names and values are the first error message for that field. Issues with a root-level path (no `path[0]` string) SHALL be collected under key `_form`.

#### Scenario: Single field validation failure
- **WHEN** `parseSafe` returns `{ success: false, issues: [{ message: 'ist erforderlich.', path: ['resource_id'] }] }`
- **THEN** `issuesToFieldErrors(issues)` returns `{ resource_id: 'ist erforderlich.' }`

#### Scenario: Multiple field validation failures
- **WHEN** `parseSafe` returns issues for both `day` and `start_min` fields
- **THEN** `issuesToFieldErrors(issues)` returns `{ day: '...', start_min: '...' }` with one entry per field

#### Scenario: Root-level issue falls back to _form key
- **WHEN** `parseSafe` returns an issue with `path: []` (root-level, e.g. cross-field refine on outer object)
- **THEN** `issuesToFieldErrors(issues)` returns `{ _form: '<message>' }`

#### Scenario: Multiple issues for same field take first message
- **WHEN** `parseSafe` returns multiple issues for the `start_min` field
- **THEN** only the first issue message is stored under `start_min`

### Requirement: readFormFieldValues extracts raw string values from FormData

The system SHALL provide a shared `readFormFieldValues(keys, formData)` utility that reads specified field names from `FormData` as string values. Fields absent from `FormData` SHALL be mapped to empty string.

#### Scenario: All fields present
- **WHEN** FormData contains `resource_id=5`, `day=2026-06-15`, `start_min=480`
- **THEN** `readFormFieldValues(['resource_id', 'day', 'start_min'], formData)` returns `{ resource_id: '5', day: '2026-06-15', start_min: '480' }`

#### Scenario: Missing field maps to empty string
- **WHEN** FormData does not contain `end_min`
- **THEN** `readFormFieldValues(['end_min'], formData)` returns `{ end_min: '' }`

### Requirement: Schema utilities live in app/utils/schema-utils.ts

The system SHALL define `issuesToFieldErrors` and `readFormFieldValues` in a single module `app/utils/schema-utils.ts`. The module SHALL have no dependencies on `remix/ui`, `remix/router`, or any controller code.

#### Scenario: Utility is importable
- **WHEN** any controller imports from `../utils/schema-utils.ts`
- **THEN** `issuesToFieldErrors` and `readFormFieldValues` are available as named exports
