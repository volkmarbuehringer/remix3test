# admin-page-base Specification

## Purpose

Provides the single canonical base contract for building admin pages and forms on the shared frame transport: server-rendered row actions, Post/Redirect/Get mutations, server-side controlled submission with inline validation errors, and grid-state preservation. It replaces per-page drift and the client-side data-mutation paths that previously lived in individual pages.

## Requirements

### Requirement: Pages render on the server by default with thin client augmentation
The system SHALL render admin pages on the server as the baseline, and SHALL add client-side code only as minimal, additive enhancement for a genuine interaction gap (such as a delete confirmation or a row context menu). All pages SHALL share the single client runtime entry. A page SHALL NOT require client-side rendering to produce its content: with client enhancement absent, the full page content, grid, and server-rendered forms SHALL still be present and functional.

#### Scenario: Server-rendered page is usable without client enhancement
- **WHEN** a page is requested and the client enhancement is not applied (no-JS)
- **THEN** the full page content, grid, and server-rendered forms are still present, and navigation falls back to full-document navigation

#### Scenario: Content is produced by the server, not the client
- **WHEN** a page is served
- **THEN** its content and forms are present in the server-rendered response, not assembled client-side

### Requirement: Admin mutations validate server-side and follow Post/Redirect/Get
The system SHALL render admin pages through the shared frame transport, and every data-mutating submission (create, update, delete, disable/enable toggle) SHALL be validated server-side. On validation failure the controller SHALL re-render the targeted frame content at an OK (200) response carrying the per-field errors and the submitted field values. On success the controller SHALL redirect (Post/Redirect/Get) back to the list. The controller SHALL NOT use a non-OK response (e.g. 400/500) to deliver a validation-failure re-render.

#### Scenario: Validation failure re-renders the frame with inline errors
- **WHEN** an admin submits a create or update form with an invalid field
- **THEN** the response is a 200 status containing the targeted frame fragment with the field error text rendered adjacent to the invalid field and the previously entered values still present

#### Scenario: Successful mutation redirects to the list
- **WHEN** an admin submits a valid create or update form
- **THEN** the response is a 3xx redirect to the list URL with the current grid state preserved

### Requirement: Row actions are server-rendered, not client-mutating
The system SHALL implement each per-row action (edit, disable/enable, delete) as a server-rendered form or link that navigates only the admin content frame. A row action SHALL NOT perform a client-side data mutation, SHALL NOT call a JSON mutation endpoint via fetch/XHR, and SHALL NOT trigger a client-side frame reload after a mutation. A destructive row action SHALL confirm before submitting.

#### Scenario: Row delete submits a server form with confirmation
- **WHEN** an admin clicks the delete action on a row
- **THEN** a confirmation prompt is shown, and on confirmation the row's server-rendered form is submitted to the delete route targeting the admin content frame without a full-page navigation

#### Scenario: Row action does not issue a client-side mutation request
- **WHEN** an admin triggers a row action
- **THEN** no fetch/XHR request to a JSON mutation endpoint is issued and no client-side frame reload follows the action

### Requirement: Client-driven enhancements are input affordances, not mutation endpoints
A client-driven enhancement (such as a delete confirmation or a right-click context menu) SHALL alter only user-input handling and SHALL signal its action by submitting the existing server-rendered form (for example via `form.requestSubmit()`). It SHALL NOT issue a client-side request that mutates data directly.

#### Scenario: Context-menu action submits the existing server form
- **WHEN** an admin chooses an action from the row context menu
- **THEN** the corresponding existing server-rendered form is submitted; no direct client-side mutation request is sent

### Requirement: Disable/enable toggle is a server form with Post/Redirect/Get
The system SHALL render the per-row disable/enable toggle as a server-rendered POST form targeting the admin content frame. Because the toggle has no inline error field, a toggle failure SHALL redirect back and surface the error via a flash message rather than a 200 re-render with per-field errors.

#### Scenario: Toggle success redirects and preserves grid state
- **WHEN** an admin toggles a row's disabled state via the toggle form
- **THEN** the controller updates the state and redirects (3xx) back to the list URL with the current grid state preserved, and the row shows the new status

#### Scenario: Toggle failure redirects with a flash message
- **WHEN** a toggle submission cannot be applied (such as an invalid row id or a protected record)
- **THEN** the controller redirects back to the list and surfaces the error via a flash message; the response is not a 200 per-field-error re-render

### Requirement: Grid state is preserved across all mutations and navigations
The system SHALL carry the current grid state (page offset, sort column, sort order, active filter) on every mutation and every sort, paginate, and filter navigation. After a redirect or a list re-render, the grid SHALL be at the same offset, sort, and filter, and after a create or edit the affected row SHALL remain in view.

#### Scenario: Mutation retains sort, filter, and offset
- **WHEN** an admin edits a row after sorting and filtering the list on a later page and submits the change
- **THEN** the redirected list re-renders at the same offset, sort column, sort order, and filter, with the edited row highlighted

#### Scenario: Pagination and filter preserve grid state in the URL
- **WHEN** an admin sorts, paginates, or filters the grid
- **THEN** the resulting frame navigation carries the offset, sort, order, and filter parameters so the grid state is reproducible across reloads
