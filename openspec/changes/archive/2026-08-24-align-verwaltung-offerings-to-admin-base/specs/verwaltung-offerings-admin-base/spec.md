## Purpose

Defines how the `/verwaltung/offerings` CRUD page conforms to the shared admin page/form base contract so its create, edit, delete, config, week-generate, and delete-past flows behave consistently with `/admin/users`: server-rendered row actions, Post/Redirect/Get mutations, 200 inline-error re-renders, flash-based non-field errors, and grid-state round-trip — while keeping the dedicated `verwaltung` layout and the offerings-specific features.

## ADDED Requirements

### Requirement: Offerings mutations validate server-side and follow Post/Redirect/Get
The system SHALL validate every data-mutating offers submission (create, update, delete) server-side through the shared frame transport. On validation failure the controller SHALL re-render the targeted frame content at an OK (200) status carrying the per-field errors and the submitted field values. On success the controller SHALL redirect (Post/Redirect/Get) back to the grid with the current grid state preserved. The controller SHALL NOT use a non-OK response (such as 400 or 500) to deliver a validation-failure re-render.

#### Scenario: Create validation failure re-renders the frame with inline errors
- **WHEN** an admin submits the create form with an invalid field (empty day, invalid resource, or end time not after start time)
- **THEN** the response is a 200 status containing the targeted frame fragment with the field error text rendered adjacent to the invalid field and the previously entered values still present

#### Scenario: Update validation failure re-renders the frame with inline errors
- **WHEN** an admin submits an invalid edit form
- **THEN** the response is a 200 status containing the targeted frame fragment with the inline errors and the previously entered values still present

#### Scenario: Successful create redirects to the grid and keeps the row in view
- **WHEN** an admin submits a valid create form
- **THEN** the response is a 3xx redirect to the grid URL with the grid-state parameters (offset, sort, order, filter, period, status) preserved and the created row selected for editing

#### Scenario: Successful update redirects to the grid
- **WHEN** an admin submits a valid edit form
- **THEN** the response is a 3xx redirect to the grid URL with the current grid state preserved

#### Scenario: Successful delete redirects to the grid
- **WHEN** an admin confirms a row delete
- **THEN** the row's server-rendered DELETE form is submitted and the controller redirects (3xx) back to the grid URL with the current grid state preserved

### Requirement: Offerings row actions are server-rendered and target the frame
The system SHALL render each per-row action (edit, delete) as a server-rendered form or link that navigates only the target content frame via `data-rmx-target`. A row action SHALL NOT perform a client-side data mutation, SHALL NOT call a JSON mutation endpoint via fetch/XHR, and SHALL NOT trigger a client-side frame reload after a mutation. A destructive row action SHALL confirm before submitting.

#### Scenario: Row edit is a server-rendered frame-targeted link
- **WHEN** an admin clicks the edit action on a row
- **THEN** the server-rendered edit link navigates the target content frame to the grid URL with `editing=<id>` and the current grid-state parameters, and the inline edit panel appears without a full-page navigation

#### Scenario: Row delete submits a server form with confirmation
- **WHEN** an admin clicks the delete action on a row
- **THEN** a confirmation prompt is shown, and on confirmation the row's server-rendered DELETE form is submitted targeting the content frame without a full-page navigation

#### Scenario: Row action does not issue a client-side mutation request
- **WHEN** an admin triggers a row action
- **THEN** no fetch/XHR request to a JSON mutation endpoint is issued and no client-side frame reload follows the action

### Requirement: Offerings client-driven enhancements are input affordances
A client-driven enhancement (right-click context menu) SHALL alter only user-input handling and SHALL either submit the existing server-rendered form or navigate the target frame; it SHALL NOT issue a client-side request that mutates data directly.

#### Scenario: Context-menu edit navigates the frame
- **WHEN** an admin chooses Edit from the row context menu
- **THEN** the frame is navigated (not a full-document `window.location.href`) to the grid URL with `editing=<id>` and the current grid-state parameters preserved

#### Scenario: Context-menu delete submits the existing server form
- **WHEN** an admin chooses Delete from the row context menu and confirms
- **THEN** the corresponding existing server-rendered DELETE form is submitted via `form.requestSubmit()`; no direct client-side mutation request is sent

### Requirement: Offerings non-field errors surface via redirect and flash
Non-field errors and action results with no inline field (week-generate result, delete-past result, config-save result, invalid id, not-found record) SHALL be delivered by redirecting (Post/Redirect/Get) back to the grid and surfacing the message via `session.flash`. The controller SHALL NOT deliver these via a `?error=` query parameter or a non-OK JSON response.

#### Scenario: Week-generate result redirects with a flash message
- **WHEN** an admin submits the week-generate form
- **THEN** the controller creates the week's offerings and redirects (3xx) back to the grid, surfacing the created/skipped/error summary via a flash message

#### Scenario: Delete-past result redirects with a flash message
- **WHEN** an admin confirms deleting past offerings
- **THEN** the controller deletes the past offerings and redirects (3xx) back to the grid, surfacing the deleted count via a flash message

#### Scenario: Config-save failure redirects with a flash message
- **WHEN** an admin submits an invalid config form
- **THEN** the controller redirects (3xx) back to the grid and surfaces the validation message via a flash message instead of returning a non-OK JSON response

#### Scenario: Invalid row id redirects with a flash message
- **WHEN** a mutation references an invalid or missing row id
- **THEN** the controller redirects (3xx) back to the grid and surfaces the error via a flash message instead of returning a non-OK JSON response

### Requirement: Offerings grid state is preserved across all mutations and navigations
The system SHALL carry the current grid state (offset, sort column, sort order, filter, period, status) on every mutation and every sort, paginate, and filter navigation. After a redirect or a list re-render the grid SHALL be at the same offset, sort, and filter, and after a create or edit the affected row SHALL remain in view.

#### Scenario: Mutation retains sort, filter, and offset
- **WHEN** an admin edits a row after sorting and filtering the list on a later page and submits the change
- **THEN** the redirected grid re-renders at the same offset, sort column, sort order, filter, period, and status, with the edited row highlighted

#### Scenario: Filter and pagination preserve grid state in the URL
- **WHEN** an admin sorts, paginates, filters, or changes the period/status of the grid
- **THEN** the resulting frame navigation carries the offset, sort, order, filter, period, and status parameters so the grid state is reproducible across reloads
