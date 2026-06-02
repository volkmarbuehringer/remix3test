## MODIFIED Requirements

### Requirement: Admin offering form SHALL render per-field validation errors inline

When the admin creates or edits an offering and validation fails, the form SHALL display error messages adjacent to the specific field that failed, not only as a form-level banner. The controller SHALL redirect (302) with grid-state-preserving URL params encoding both field errors (`fe_*`) and submitted form values (`fv_*`), as `context.render()` from POST is incompatible with `createSidebarLayout` Frame architecture.

#### Scenario: Required field is empty
- **WHEN** admin submits the create form with an empty "Tag" (day) field
- **THEN** the controller redirects to `/admin/offerings?offset=...&sort=...&creating=true&fv_day=&fe_day=...` preserving grid state
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

### Requirement: Admin offering form SHALL preserve submitted values on validation failure

When validation fails and the controller redirects, the form SHALL retain all submitted input values so the admin can correct errors without re-entering valid fields. Form values SHALL be encoded as `fv_*` URL query parameters in the redirect and decoded by the GET handler.

#### Scenario: Values preserved after single-field error
- **WHEN** admin fills "Tag" with "2026-06-15", selects resource_id=5, and submits with an invalid start_min
- **THEN** the redirect URL contains `fv_day=2026-06-15&fv_resource_id=5&fv_start_min=...&fv_end_min=...`
- **AND** the re-rendered form shows "2026-06-15" in the day input and resource_id=5 selected

#### Scenario: Select values preserved
- **WHEN** admin selects resource_id=3 and submits with an invalid day format
- **THEN** the redirect URL contains `fv_resource_id=3`
- **AND** the resource dropdown shows resource_id=3 selected in the re-rendered form

### Requirement: Form inputs SHALL apply error styling on validation failure

The shared `input.error` CSS mixin from `app/ui/mixins/input.ts` SHALL be applied to inputs that have a field-level error decoded from `fe_*` URL params.

#### Scenario: Errored input shows red border
- **WHEN** the day input has a field-level error from decoded `fe_day` param
- **THEN** the input element SHALL have the `input.error` mixin applied, rendering a red border

#### Scenario: Valid input shows normal styling
- **WHEN** an input has no field-level error
- **THEN** the input element SHALL use the standard `input.base` mixin without `input.error`
