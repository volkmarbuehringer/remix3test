## MODIFIED Requirements

### Requirement: Resources form SHALL preserve field values on validation failure

When the admin creates or updates a resource and validation fails, the form SHALL retain all submitted input values via `formValues` props passed from the controller. The controller SHALL re-render the page with status 200, carrying the submitted field values and the inline per-field errors through the shared frame transport. The controller SHALL NOT use a non-OK response (such as 400 or 500) to deliver the validation-failure re-render.

#### Scenario: Empty description preserves previous input

- **WHEN** admin submits the create form with an empty description
- **THEN** the controller re-renders the page with status 200
- **AND** the description input retains the empty string value the user submitted

#### Scenario: Description preserved on update error

- **WHEN** admin edits a resource and submits with an empty description
- **THEN** the re-rendered form shows the empty description in the input field

## ADDED Requirements

### Requirement: Resources non-field errors surface via redirect and flash

Non-field error paths with no inline field (an invalid or missing row id, and a delete blocked by a foreign-key constraint) SHALL be delivered by redirecting (Post/Redirect/Get) back to the grid and surfacing the message via `session.flash`. The controller SHALL NOT deliver these via a non-OK JSON response or a 400 `formError` re-render.

#### Scenario: Delete blocked by a foreign-key constraint redirects with a flash message

- **WHEN** admin deletes a resource that is still referenced by an appointment
- **THEN** the controller redirects (3xx) back to the grid and surfaces the block message via a flash message instead of re-rendering with a `formError` banner

#### Scenario: Invalid or missing row id redirects with a flash message

- **WHEN** an update or delete references an invalid or missing row id
- **THEN** the controller redirects (3xx) back to the grid and surfaces the error via a flash message instead of returning a non-OK response
