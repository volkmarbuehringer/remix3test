## Purpose

Specifies form validation behavior for the admin offering-configs management page at `/verwaltung/offering-configs`. On validation failure, the controller re-renders the page directly with `formValues` and `fieldErrors` props, providing inline error display and field value preservation.

## Requirements

### Requirement: Offering-configs form SHALL preserve field values on validation failure

When the admin creates or updates an offering config and validation fails, the form SHALL retain all submitted input values via `formValues` props passed from the controller. The controller SHALL re-render the page with status 400.

#### Scenario: Invalid resource_id preserves form state
- **WHEN** admin submits the create form with a missing or invalid resource_id
- **THEN** the controller re-renders the page with status 400
- **AND** all day checkbox and time values the user entered are preserved

#### Scenario: Time range values preserved on error
- **WHEN** admin enters monday_start=600, monday_end=300 and submits
- **THEN** the re-rendered form shows monday_start=600 and monday_end=300 in their inputs
- **AND** monday_enabled checkbox remains checked

### Requirement: Offering-configs form SHALL display inline per-field errors

Validation errors for the offering-configs form SHALL display as inline messages adjacent to the affected field. Error styling (red border) SHALL be applied to inputs with errors.

#### Scenario: Missing resource_id shows inline error
- **WHEN** admin submits the create form without selecting a resource
- **THEN** an inline error message appears below the resource select
- **AND** the resource select has a red border for error styling

#### Scenario: No days enabled shows form-level error
- **WHEN** admin submits with no day checkboxes enabled
- **THEN** a form-level error message "At least one day must have a time range" is displayed
