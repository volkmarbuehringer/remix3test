## ADDED Requirements

### Requirement: Resources form SHALL include capabilities field validation

The resource form validation schema SHALL include the new `capabilities` field. The capabilities field SHALL accept any string value with no minimum length requirement.

#### Scenario: Capabilities value preserved on validation failure
- **WHEN** admin submits the create form with a valid name and description but the capabilities field is empty
- **THEN** the empty capabilities value is retained in the re-rendered form

#### Scenario: Capabilities value preserved on update error
- **WHEN** admin edits a resource, enters capabilities text, and another field fails validation
- **THEN** the re-rendered form shows the entered capabilities text in the textarea
