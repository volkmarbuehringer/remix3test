## MODIFIED Requirements

### Requirement: Resource-oriented write actions

The system SHALL expose exactly four write actions on the session-auth `/lists` route map: `create` (`POST /`), `update` (`PUT /:id`), `destroy` (`POST /:id/delete`), and `move` (`POST /:id/move`). The previous `save`, `rename`, and `data` actions MUST NOT exist.

#### Scenario: Create a new list

- **WHEN** the client sends `POST /lists` with a JSON body `{ description, items }` and a valid CSRF token
- **THEN** the server creates the list, assigns stable ids to every item, and responds `200` with `{ id, description, items, updated_at }`

#### Scenario: Update replaces only the supplied fields

- **WHEN** the client sends `PUT /lists/:id` with body `{ description }`
- **THEN** the server updates only `description` and `updated_at`; the `items` array is unchanged

- **WHEN** the client sends `PUT /lists/:id` with body `{ items }`
- **THEN** the server updates only `items` (preserving any item ids the client sent, assigning ids to new ones) and `updated_at`; `description` is unchanged

- **WHEN** the client sends `PUT /lists/:id` with an empty body (neither `description` nor `items`)
- **THEN** the server responds `400` with an error indicating at least one field is required

#### Scenario: Move item between lists

- **WHEN** the client sends `POST /lists/:sourceId/move` with a JSON body `{ targetId, itemId }` and a valid CSRF token
- **THEN** the server removes the item identified by `itemId` from the source list, appends it to the target list, bumps `updated_at` on both lists within a single transaction, and responds `200` with the updated source and target rows

### Requirement: Dead show route removed

The route map MUST NOT include a `lists.show` action, the controller MUST NOT define a `show` handler, and the file `app/actions/lists/show-page.tsx` MUST NOT exist.

#### Scenario: No show route in route map

- **WHEN** the route map is inspected
- **THEN** the `lists` route contains only `index`, `create`, `update`, `destroy`, and `move`
- **AND** no `lists.show` reference exists in `app/`

## ADDED Requirements

### Requirement: Item done state

List items SHALL carry an optional boolean `done` flag. An item without a `done` field reads as `false`. The flag MUST survive all write operations — create, update, and move — without being dropped or rewritten. Toggling the flag on an existing item SHALL persist it via the normal update path.

#### Scenario: Toggling an item updates its done flag

- **WHEN** the user clicks the checkbox on an unchecked item
- **THEN** the item renders as checked with a struck-through, muted label
- **AND** the client marks the list dirty and triggers the fast autosave path (300 ms debounce)
- **AND** the persisted item has `done: true` and retains its original id

#### Scenario: Existing items without done are unchecked

- **WHEN** a list row contains items stored before this change (no `done` field)
- **THEN** the editor renders each such item unchecked and the server does not require a migration

### Requirement: Sidebar progress indicator

The sidebar entry for each list SHALL display a progress indicator reflecting how many of the list's items are done, alongside the existing item count.

#### Scenario: Sidebar shows done count

- **WHEN** the sidebar renders a list whose items include 3 done of 7 total
- **THEN** the badge displays the done/total figures derived from the list row, e.g. `3/7`

### Requirement: Cross-list move via drag

The sidebar list rows SHALL act as drop targets for item drags. Dropping an item on a sidebar row SHALL move that item from its current list into the target list, appended at the end. The move MUST respect per-user ownership: a non-admin user MAY move an item only between lists they own; an admin MAY move between any lists. The source list's precondition SHALL be enforced (stale source -> `409`), and moving an item when it is the last remaining item of the source list MUST be rejected (`400`) — a list can never be emptied via drag. Moving an item into its own source list MUST be rejected (`400`).

#### Scenario: Drag item onto another list

- **WHEN** the user drags item `B` from list `A` and drops it on the sidebar row for list `C`
- **THEN** list `A` no longer contains `B`, list `C` contains `B` appended after its existing items, and both `updated_at` values change
- **AND** the client flushes pending autosave and reloads the frame so the sidebar and editor re-read from the server

#### Scenario: Move rejected for last item

- **WHEN** the user drags the only remaining item of a list onto another list's sidebar row
- **THEN** the server responds `400` and neither list is modified

#### Scenario: Move to own list rejected

- **WHEN** the user drops an item on the sidebar row of the list it already belongs to
- **THEN** the server responds `400` and the list is not modified

#### Scenario: Foreign list move forbidden

- **WHEN** a non-admin user drops an item onto a list owned by another user
- **THEN** the server responds `404` and neither list is modified

#### Scenario: Stale source precondition rejected

- **WHEN** the client sends a move whose source `If-Match` does not match the source row's current `updated_at`
- **THEN** the server responds `409` with the current source row and does not modify either list

### Requirement: Move gesture feedback

During a drag, the sidebar rows SHALL render an explicit drop highlight when hovered, and the intra-list reorder indicator (border above/below a target row) and the cross-list sidebar highlight MUST be mutually exclusive — hovering a sidebar row SHALL suppress the intra-list indicator and vice versa.

#### Scenario: Sidebar row highlight on hover

- **WHEN** a drag is in progress and the pointer enters a sidebar row
- **THEN** that row is visually highlighted as a valid drop target and no intra-list reorder border is shown

#### Scenario: Reorder indicator returns over the editor

- **WHEN** a drag is in progress and the pointer leaves the sidebar and re-enters the item list
- **THEN** the intra-list reorder indicator logic applies again and no sidebar row remains highlighted
