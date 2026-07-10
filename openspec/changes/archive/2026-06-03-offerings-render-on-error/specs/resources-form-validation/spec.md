## ADDED Requirements

### Requirement: Resources form SHALL preserve field values on validation failure

When the admin creates or updates a resource and validation fails, the form SHALL retain all submitted input values via `formValues` props passed from the controller. The controller SHALL re-render the page with status 400.

#### Scenario: Empty description preserves previous input

- **WHEN** admin submits the create form with an empty description
- **THEN** the controller re-renders the page with status 400
- **AND** the description input retains the empty string value the user submitted

#### Scenario: Description preserved on update error

- **WHEN** admin edits a resource and submits with an empty description
- **THEN** the re-rendered form shows the empty description in the input field

### Requirement: Resources form SHALL display inline per-field errors

Validation errors for the resources form SHALL display as inline messages below the affected field, not only as a JSON response body. The error message SHALL appear adjacent to the field that failed validation.

#### Scenario: Empty description shows inline error

- **WHEN** admin submits the create form with an empty description
- **THEN** an inline error message "Description is required" appears below the description input
- **AND** the description input has a red border for error styling

#### Scenario: Successful submission shows no errors

- **WHEN** admin submits the create form with a valid description
- **THEN** no inline errors are displayed
- **AND** the browser redirects to the resources page showing the new row
