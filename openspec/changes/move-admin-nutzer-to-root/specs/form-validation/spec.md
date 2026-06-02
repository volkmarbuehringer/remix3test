## ADDED Requirements

### Requirement: Nutzer form uses parseSafe with context.render

The nutzer create and update actions SHALL use `parseSafe` with schema validation on form data and `context.render()` to re-render the page with `formValues` and `fieldErrors` on validation failure, matching the pattern established for `/client` forms.

#### Scenario: Nutzer create action uses parseSafe

- **WHEN** the nutzer create handler receives form data
- **THEN** it SHALL call `readFormFieldValues(NUTZER_FORM_KEYS, formData)` to extract raw values
- **AND** it SHALL call `s.parseSafe(nutzerSaveSchema, formData)` to validate
- **AND** on failure SHALL call `issuesToFieldErrors(parsed.issues)` for field errors
- **AND** SHALL call `context.render(<Layout><NutzerPage formValues={rawValues} fieldErrors={fieldErrors} creating={true} ... /></Layout>, { status: 400 })`

#### Scenario: Nutzer update action uses parseSafe

- **WHEN** the nutzer update handler receives form data
- **THEN** it SHALL use the same `parseSafe` + `context.render()` pattern as the create action
- **AND** SHALL pass `editRow` to the page on validation failure
