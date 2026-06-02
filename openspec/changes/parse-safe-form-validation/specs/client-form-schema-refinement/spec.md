## ADDED Requirements

### Requirement: Client form schema uses .refine for all domain validation

The system SHALL move remaining inline validation from the client controller's `create` and `update` actions into `.refine()` chains on the existing `clientSaveSchema`. No inline `parseInt`, `Number()`, or manual value checks SHALL remain for field-level validation.

#### Scenario: All validation comes from schema issues
- **WHEN** `parseSafe(clientSaveSchema, formData)` is called with invalid data
- **THEN** all field-level errors are present in `result.issues` — no additional manual validation is needed before calling `issuesToFieldErrors`

#### Scenario: Registered field validates year 2026 via refine
- **WHEN** `parseSafe(clientSaveSchema, formData)` is called with `registered=31536000000` (non-2026 timestamp)
- **THEN** `result.success` is `false` with an issue on path `['registered']`

#### Scenario: Controller only checks parseSafe result
- **WHEN** the client controller's `update` action runs
- **THEN** the only validation logic after `parseSafe` is checking `result.success` — no manual `parseInt` or per-field if-checks

### Requirement: Client controller preserves re-render-from-POST pattern

The system SHALL continue using `context.render(<Layout><ClientPage ... /></Layout>, { status: 400 })` on validation failure, as `/client` uses plain `Layout` (no `ShellOrFragment`, no Frame wrapping). This pattern remains compliant with Remix 3 demos.

#### Scenario: Create validation failure re-renders with 400
- **WHEN** user submits create form with invalid data
- **THEN** controller returns `context.render(<Layout><ClientPage .../></Layout>, { status: 400 })` with formValues and fieldErrors

#### Scenario: Update validation failure re-renders with 400
- **WHEN** user submits update form with invalid data
- **THEN** controller returns `context.render(<Layout><ClientPage .../></Layout>, { status: 400 })` with formValues and fieldErrors
