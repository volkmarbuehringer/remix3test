# admin-lists-admin-base Specification

## Purpose

Defines how the `/admin/lists` CRUD page conforms to the shared admin page/form base contract so its create, edit, and delete flows behave consistently with `/admin/users`: server-rendered frame-targeted row actions, Post/Redirect/Get mutations, validation failures re-rendered as a 200 inline-error fragment, non-field errors surfaced via redirect + `session.flash`, and grid-state round-trip on every mutation — while keeping the `title`/`description` fields and leaving the jsonb `list` items array to the public ListLab.

## Requirements

### Requirement: Lists mutations validate server-side and follow Post/Redirect/Get

The system SHALL validate every data-mutating lists submission (create, update, delete) server-side through the shared frame transport. On validation failure the controller SHALL re-render the targeted admin content frame at an OK (200) status carrying the per-field errors and the submitted field values. On success the controller SHALL redirect (Post/Redirect/Get) back to the grid with the current grid state preserved. The controller SHALL NOT use a non-OK response (such as 400 or 500) to deliver a validation-failure re-render.

#### Scenario: Create validation failure re-renders the frame with inline errors

- **WHEN** an admin submits the create form with an invalid field (an empty `title`, or a `description` exceeding the max length)
- **THEN** the response is a 200 status containing the targeted frame fragment with the field error text rendered adjacent to the invalid field and the previously entered values still present

#### Scenario: Update validation failure re-renders the frame with inline errors

- **WHEN** an admin submits an invalid edit form
- **THEN** the response is a 200 status containing the targeted frame fragment with the inline errors and the previously entered values still present

#### Scenario: Successful create redirects to the grid and keeps the row in view

- **WHEN** an admin submits a valid create form
- **THEN** the response is a 3xx redirect to the grid URL with the grid-state parameters (offset, sort, order, filter) preserved and the created row selected for editing

#### Scenario: Successful update redirects to the grid

- **WHEN** an admin submits a valid edit form
- **THEN** the response is a 3xx redirect to the grid URL with the current grid state preserved

#### Scenario: Successful delete redirects to the grid

- **WHEN** an admin confirms a row delete
- **THEN** the row's server-rendered DELETE form is submitted and the controller redirects (3xx) back to the grid URL with the current grid state preserved

### Requirement: Lists row actions are server-rendered and target the frame

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

### Requirement: Lists client-driven enhancements are input affordances

A client-driven enhancement (such as a delete confirmation) SHALL alter only user-input handling and SHALL signal its action by submitting the existing server-rendered form; it SHALL NOT issue a client-side request that mutates data directly.

#### Scenario: Delete confirmation submits the existing server form

- **WHEN** an admin confirms a row delete
- **THEN** the corresponding existing server-rendered DELETE form is submitted; no direct client-side mutation request is sent

### Requirement: Lists non-field errors surface via redirect and flash

Non-field errors with no inline field (invalid row id, not-found row, and a delete blocked by a foreign-key constraint) SHALL be delivered by redirecting (Post/Redirect/Get) back to the grid and surfacing the message via `session.flash`. The controller SHALL NOT deliver these via a `?error=` query parameter, a `context.json` error response, or a non-OK re-render.

#### Scenario: Invalid row id redirects with a flash message

- **WHEN** a lists mutation references an invalid or missing row id
- **THEN** the controller redirects (3xx) back to the grid and surfaces the error via a flash message instead of returning a non-OK response

#### Scenario: Update of a not-found row redirects with a flash message

- **WHEN** an admin submits an edit for a list that no longer exists
- **THEN** the controller redirects (3xx) back to the grid and surfaces the error via a flash message

#### Scenario: Delete blocked by a foreign-key constraint redirects with a flash message

- **WHEN** an admin deletes a list that is still referenced elsewhere
- **THEN** the controller redirects (3xx) back to the grid and surfaces the block message via a flash message instead of silently redirecting

### Requirement: Lists grid state is preserved across all mutations and navigations

The system SHALL carry the current grid state (offset, sort column, sort order, filter) on every mutation and every sort, paginate, and filter navigation. After a redirect or a list re-render the grid SHALL be at the same offset, sort, and filter, and after a create or edit the affected row SHALL remain in view.

#### Scenario: Mutation retains sort, filter, and offset

- **WHEN** an admin edits a list after sorting and filtering the grid on a later page and submits the change
- **THEN** the redirected grid re-renders at the same offset, sort column, sort order, and filter, with the edited row highlighted

#### Scenario: Filter, sort, and offset preserved on create redirect

- **WHEN** an admin creates a list while the grid is filtered and sorted on a later page
- **THEN** the redirected grid retains the filter, sort, and offset rather than clearing them

#### Scenario: Pagination and filter preserve grid state in the URL

- **WHEN** an admin sorts, paginates, or filters the grid
- **THEN** the resulting frame navigation carries the offset, sort, order, and filter parameters so the grid state is reproducible across reloads

### Requirement: Lists empty state offers an explicit create entry point

When the grid has no rows and no create/edit form panel is active, the lists page SHALL render a server-rendered frame-targeted `Neu anlegen` entry point so an empty list is not a dead end.

#### Scenario: Empty grid shows a create CTA

- **WHEN** the grid renders empty with no form panel active
- **THEN** an empty-state `Neu anlegen` CTA is rendered and targets the content frame

### Requirement: Lists index supports sort, filter, and pagination

The lists index SHALL render a sortable, filterable, paginated grid whose sort column, sort order, offset, and filter are carried in the URL as grid state.

#### Scenario: Sorting a column toggles its order

- **WHEN** an admin clicks a sortable column header
- **THEN** the frame navigates to the grid URL with `sort=<column>` and `order=asc|desc` (toggling between them on repeated clicks) and the grid re-renders ordered by that column

#### Scenario: Filtering narrows the grid

- **WHEN** an admin types a filter value and submits it
- **THEN** the frame navigates to the grid URL with `filter=<value>` and the server returns only lists whose `title` or `description` matches the value case-insensitively

#### Scenario: Paginating moves the window

- **WHEN** an admin clicks the next/pager link
- **THEN** the frame navigates to the grid URL with the new `offset` plus the current sort, order, and filter

### Requirement: Lists admin form edits title/description only and preserves the items array

The admin create/update form SHALL expose only the `title` and `description` fields. An update SHALL leave the jsonb `list` items array and the owning user unchanged. A create SHALL start the list with an empty items array.

#### Scenario: Update preserves the items array

- **WHEN** an admin submits an edit that changes a list's `title` or `description`
- **THEN** the server updates only `title`/the `description`/the `updated_at` value and the existing `list` items array is unchanged

#### Scenario: Create starts with an empty items array

- **WHEN** an admin creates a list with a valid `title` and `description`
- **THEN** the server creates the list with an empty items array and no owning user set

### Requirement: Lists form preserves field values on validation failure

When the admin creates or updates a list and validation fails, the form SHALL retain all submitted input values via `formValues` props passed from the controller, and the controller SHALL re-render with status 200 carrying the submitted values and inline per-field errors.

#### Scenario: Description preserved on update error

- **WHEN** an admin edits a list and submits an invalid `title`
- **THEN** the re-rendered form shows the submitted `title` and `description` values in their inputs