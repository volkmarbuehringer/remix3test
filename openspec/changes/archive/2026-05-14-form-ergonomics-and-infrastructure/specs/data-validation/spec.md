## ADDED Requirements

### Requirement: Login form validates email format

The login controller SHALL use `s.string().pipe(email())` for the email field in its form data schema.

#### Scenario: Login with invalid email shows error
- **WHEN** a login request has an email that does not match email format
- **THEN** the action SHALL re-render the login page with a validation error message
- **THEN** the response status SHALL be 400

#### Scenario: Login with empty email shows error
- **WHEN** a login request has an empty email field
- **THEN** the action SHALL re-render the login page with a validation error message

### Requirement: Register form validates password minimum length

The register controller SHALL use `s.string().pipe(minLength(8))` for the password field in its form data schema.

#### Scenario: Register with short password shows error
- **WHEN** a register request has a password shorter than 8 characters
- **THEN** `s.parse()` SHALL throw a parse error
- **THEN** the action SHALL re-render the register page with a validation error message

### Requirement: Register form validates required name field

The register schema SHALL enforce non-empty name via `s.string().pipe(minLength(1))`.

#### Scenario: Register with empty name shows error
- **WHEN** a register request has an empty name field
- **THEN** `s.parse()` SHALL throw a parse error
- **THEN** the action SHALL re-render with a validation error message

### Requirement: Client CRUD validates rowId as numeric

The client save and destroy controllers SHALL parse `rowId` using data-schema coercion rather than raw `Number()`.

#### Scenario: Client save with non-numeric rowId returns 400
- **WHEN** a client save request has a non-numeric `rowId`
- **THEN** the action SHALL return a 400 response with an error message

### Requirement: Schemas use defaulted values where appropriate

Form data schemas SHALL use `s.defaulted(s.string(), '')` for text inputs to ensure null-safe defaults.

#### Scenario: Schema with defaulted field receives undefined
- **WHEN** a form field is not present in the request
- **THEN** the parsed value SHALL be an empty string instead of undefined

### Requirement: Boolean coercion for checkbox fields

Schemas for boolean fields SHALL use `coerce.boolean()` to handle the HTML checkbox convention (value is "on" when checked, missing when unchecked).

#### Scenario: Checked checkbox coerces to true
- **WHEN** a checkbox field value is "on"
- **THEN** `coerce.boolean()` SHALL return `true`

#### Scenario: Unchecked checkbox coerces to false
- **WHEN** a checkbox field is not present
- **THEN** `coerce.boolean()` SHALL return `false`
