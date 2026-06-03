## MODIFIED Requirements

### Requirement: Admin offering form SHALL render per-field validation errors inline

When the admin creates or edits an offering and validation fails, the form SHALL display error messages adjacent to the specific field that failed, not only as a form-level banner. The controller SHALL redirect (302) with grid-state-preserving URL params encoding both field errors (`fe_*`) and submitted form values (`fv_*`), as `context.render()` from POST is incompatible with `createSidebarLayout` Frame architecture. The route prefix for these operations SHALL be `/verwaltung` instead of `/admin`.

#### Scenario: Required field is empty
- **WHEN** admin submits the create form with an empty "Tag" (day) field
- **THEN** the controller redirects to `/verwaltung/offerings?offset=...&sort=...&creating=true&fv_day=&fe_day=...` preserving grid state
- **AND** the GET /index handler decodes `fv_*`/`fe_*` params and renders the form with a red border on the day input and an inline message

#### Scenario: Invalid resource selected
- **WHEN** admin submits the form with an invalid resource_id
- **THEN** the controller redirects with `fe_resource_id=...` in URL params
- **AND** the re-rendered form shows inline error on the resource select

#### Scenario: Start time after end time
- **WHEN** admin submits the form with start_min=1020 and end_min=480
- **THEN** the controller redirects with `fe_end_min=...` in URL params
- **AND** the re-rendered form shows inline error on the end_min select

#### Scenario: Multiple fields fail validation
- **WHEN** admin submits the form with multiple invalid fields
- **THEN** each failed field's error is encoded as `fe_<field>` in the redirect URL
- **AND** the re-rendered form displays each inline error simultaneously
