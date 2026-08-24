## MODIFIED Requirements

### Requirement: Admin offering form SHALL render per-field validation errors inline
When the admin creates or edits an offering and validation fails, the controller SHALL re-render the page directly (status 200) with `formValues` and `fieldErrors` passed as props, displaying error messages adjacent to the specific field that failed. The route prefix for these operations SHALL be `/verwaltung`. The re-render SHALL use an OK (200) status so the shared frame transport renders the inline errors and preserved values instead of an unrecoverable error card.

#### Scenario: Required field is empty
- **WHEN** admin submits the create form with an empty "Tag" (day) field
- **THEN** the controller re-renders the page with status 200
- **AND** the form shows a red border on the day input and an inline error message

#### Scenario: Invalid resource selected
- **WHEN** admin submits the form with an invalid resource_id
- **THEN** the controller re-renders the page with status 200
- **AND** the form shows inline error on the resource select

#### Scenario: Start time after end time
- **WHEN** admin submits the form with start_min=1020 and end_min=480
- **THEN** the controller re-renders the page with status 200
- **AND** the form shows inline error on the end_min select

#### Scenario: Multiple fields fail validation
- **WHEN** admin submits the form with multiple invalid fields
- **THEN** the controller re-renders the page with status 200
- **AND** the form displays each inline error simultaneously
