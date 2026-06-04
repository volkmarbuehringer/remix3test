## ADDED Requirements

### Requirement: All form validation uses parseSafe

Every controller in `app/actions/` that validates submitted form data SHALL use `s.parseSafe()` with the discriminated union pattern (`if (!parsed.success)`) instead of `s.parse()` with try/catch or bare `s.parse()` with no error handler.

The `issuesToFieldErrors()` utility from `app/utils/schema-utils.ts` SHALL be used to convert validation issues into a `Record<string, string>` mapping field names to error messages.

#### Scenario: Login controller uses parseSafe
- **WHEN** login form is submitted
- **THEN** the controller calls `s.parseSafe(loginSchema, context.formData)`
- **AND** on failure, returns `context.render(<LoginPage error="..." errors={fieldErrors} />, { status: 400 })`

#### Scenario: Register controller uses parseSafe
- **WHEN** registration form is submitted
- **THEN** the controller calls `s.parseSafe(registerSchema, context.formData)`
- **AND** on failure, returns `context.render(<RegisterPage error="..." errors={fieldErrors} />, { status: 400 })`

#### Scenario: Admin users create/update uses parseSafe
- **WHEN** admin user form is submitted
- **THEN** the controller calls `s.parseSafe(userCreateSchema, formData)` or `s.parseSafe(userUpdateSchema, formData)`
- **AND** on failure, renders the page with field-level errors

#### Scenario: Lists save uses parseSafe
- **WHEN** lists save form is submitted
- **THEN** the controller calls `s.parseSafe(listsSaveSchema, formData)`
- **AND** on failure, renders with validation errors

#### Scenario: Workflow form uses parseSafe
- **WHEN** workflow form is submitted
- **THEN** the controller calls `s.parseSafe(workflowSchema, formData)`
- **AND** on failure, renders with validation errors

### Requirement: Controllers with bare s.parse() gain error handling

Controllers that currently call `s.parse()` without any try/catch or error handler SHALL use `s.parseSafe()` and return a proper error response on validation failure instead of crashing with an unhandled 500.

#### Scenario: Agent message validation fails
- **WHEN** agent form is submitted with invalid data
- **THEN** controller returns `context.render(<AgentPage error="Invalid input." />, { status: 400 })`
- **AND** does NOT propagate an unhandled ValidationError

#### Scenario: Chat message validation fails
- **WHEN** chat form is submitted with invalid data
- **THEN** controller returns `context.render(<ChatPage error="Invalid input." />, { status: 400 })`
- **AND** does NOT propagate an unhandled ValidationError

#### Scenario: Admin messages validation fails
- **WHEN** admin messages form is submitted with invalid data
- **THEN** controller returns `context.render(<AdminMessagesPage error="Invalid input." />, { status: 400 })`
- **AND** does NOT propagate an unhandled ValidationError

### Requirement: Appointtype and appointment controllers report field-level errors

The `appointtype-controller.tsx` and `appointment-controller.tsx` controllers currently use `parseSafe` but return a generic "Validation failed." error. They SHALL use `issuesToFieldErrors()` to return per-field error messages instead.

#### Scenario: Appointtype create with missing fields
- **WHEN** appointtype form is submitted with missing required fields
- **THEN** controller returns field-level errors identifying which fields failed
- **AND** the response includes `errors` with the specific error messages from the schema

#### Scenario: Appointment update with invalid data
- **WHEN** appointment form is submitted with invalid data
- **THEN** controller returns field-level errors identifying the failed fields

### Requirement: AuthForm supports field-level error display

The `AuthForm` component in `app/ui/auth-card.tsx` SHALL accept an optional `errors` prop and `AuthFormErrors` type. The auth page components SHALL render per-field error messages using `aria-invalid`, `aria-describedby`, and inline error `<span>` elements when field errors are present.

#### Scenario: Login with empty fields shows field-level errors
- **WHEN** login form is submitted with empty email and password
- **THEN** the re-rendered page shows error messages next to each failed field
- **AND** failed inputs have `aria-invalid="true"`
- **AND** error spans have `role="alert"`

#### Scenario: Register with short password shows field error
- **WHEN** registration form is submitted with password shorter than 8 characters
- **THEN** the re-rendered page shows "Must be at least 8 characters" next to the password field

### Requirement: Non-form s.parse() calls are preserved

Query parameter and route parameter parsing using `s.parse()` (not form data validation) SHALL remain unchanged. Only form data validation calls are refactored.

#### Scenario: Lists pagination still parses page numbers
- **WHEN** lists controller parses `url.searchParams.get('page')` with `s.parse(s.number(), ...)`
- **THEN** the existing try/catch pattern for parameter parsing remains unchanged
