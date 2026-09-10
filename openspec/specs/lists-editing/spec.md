## Requirements

### Requirement: Stable item identity

The system SHALL assign each list item a stable string id at creation time. An item's id MUST NOT change for the lifetime of that item — it survives deletion of sibling items, reordering, and label edits. The system MUST NOT rewrite sibling item ids when one item is deleted or moved.

#### Scenario: Delete preserves sibling ids

- **WHEN** a list contains items `[A, B, C]` (ids `a1, b2, c3`) and the client deletes item `B`
- **THEN** the persisted list contains items `[A, C]` with ids `a1, c3` unchanged

#### Scenario: Drag reordering preserves ids

- **WHEN** the client reorders items by drag (e.g., move the third item to the first position)
- **THEN** the persisted items array reflects the new order but every item retains its original id

#### Scenario: New items receive a fresh id

- **WHEN** the client adds a new item that has no id
- **THEN** the server assigns a fresh, unique string id to that item before persisting

### Requirement: Resource-oriented write actions

The system SHALL expose the following write actions on the session-auth `/lists` route map: `create` (`POST /`), `update` (`PUT /:id`), `destroy` (`POST /:id/delete`), `move` (`POST /:id/move`), `copy` (`POST /:id/copy`), and `merge` (`POST /:id/merge`). The previous `save`, `rename`, and `data` actions MUST NOT exist.

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

#### Scenario: Merge lists

- **WHEN** the client sends `POST /lists/:sourceId/merge` with a JSON body `{ targetId }`, a valid CSRF token, and an `If-Match` matching the source row's `updated_at`
- **THEN** the server appends a fresh-id copy of every source item to the target list, bumps the target's `updated_at`, leaves the source unchanged, and responds `200` with the updated target row

### Requirement: Optimistic concurrency on writes

Every `create` and `patch` response SHALL include the new `updated_at` in the body. Every `patch` request SHALL send the client's last-known `updated_at` via the `If-Match` header (or `_if_match` body field as a beacon fallback). The server MUST reject a `patch` whose precondition does not match the row's current `updated_at` with `409 Conflict` and a body containing the current row.

#### Scenario: Matching precondition succeeds

- **WHEN** the client sends `PATCH /lists/:id` with `If-Match: <loaded_updated_at>` matching the row's current `updated_at`
- **THEN** the server applies the patch, bumps `updated_at`, and responds `200` with the new row including the new `updated_at`

#### Scenario: Stale precondition returns 409

- **WHEN** the client sends `PATCH /lists/:id` with `If-Match: <stale_updated_at>` that does not match the row's current `updated_at`
- **THEN** the server responds `409` with a body containing the current row (`{ id, description, items, updated_at }`) and does not modify the row

#### Scenario: Force overwrite after conflict

- **WHEN** the user chooses "Trotzdem speichern" after a `409`
- **THEN** the client re-sends `PATCH /lists/:id` with `If-Match` set to the `updated_at` returned in the `409` body
- **AND** the server applies the patch because the precondition now matches

### Requirement: Loaded list data delivered with the frame response

When the `index` action receives `?load=:id` and a list with that id exists and is owned by the current user (or the user is admin), the response SHALL include the list's full row as initial state for the `ListsClient` component, requiring no second fetch. The previous `data` action MUST be removed.

#### Scenario: Frame response carries loaded list

- **WHEN** the browser navigates the `lists` frame to `/lists?load=42` and list `42` belongs to the current user
- **THEN** the response renders the sidebar shell plus the editor with initial `description`, `items`, and `updated_at` populated from the row
- **AND** the client does not issue a follow-up `GET /lists/42/data` request

#### Scenario: Unknown or foreign list falls back to new-list state

- **WHEN** the browser navigates to `/lists?load=9999` and list `9999` does not exist or is not owned by the current user
- **THEN** the response renders the sidebar shell plus an empty "new list" editor (no `loadedListId`)

### Requirement: Autosave with dirty-state indicator

The editor SHALL autosave pending changes via a debounced `PATCH` after the user is idle for a default of 1500 ms (300 ms when triggered by an add-item or blur event). The control bar SHALL display one of: `Gespeichert` (saved), `Speichern…` (saving), `Ungespeichert` (dirty, queued), or `Fehler` (last save failed). Manual `Aktualisieren` / `Hinzufügen` buttons SHALL remain available as a non-default escape hatch that flushes pending changes immediately.

#### Scenario: Typing pauses then autosaves

- **WHEN** the user edits the description and stops typing for 1500 ms
- **THEN** the client sends `PATCH /lists/:id` with `{ description }` and the current `If-Match`
- **AND** the status pill transitions `Ungespeichert` → `Speichern…` → `Gespeichert`

#### Scenario: Add item triggers fast autosave

- **WHEN** the user adds a new item
- **THEN** the debounce window is shortened to 300 ms for that event
- **AND** if the user does nothing else for 300 ms, the client sends `PATCH /lists/:id` with `{ items }`

#### Scenario: Conflict suspends autosave

- **WHEN** an autosave attempt receives `409 Conflict`
- **THEN** the client stops further autosave attempts and displays the conflict banner
- **AND** the status pill shows `Fehler`

#### Scenario: Manual flush

- **WHEN** the user clicks the demoted `Aktualisieren` or `Hinzufügen` button while dirty
- **THEN** the client immediately sends `PATCH /lists/:id` with all pending changes, bypassing the debounce

### Requirement: Dead show route removed

The route map MUST NOT include a `lists.show` action, the controller MUST NOT define a `show` handler, and the file `app/actions/lists/show-page.tsx` MUST NOT exist.

#### Scenario: No show route in route map

- **WHEN** the route map is inspected
- **THEN** the `lists` route contains only `index`, `create`, `update`, `destroy`, `move`, `copy`, and `merge`
- **AND** no `lists.show` reference exists in `app/`

### Requirement: Per-user ownership scoping preserved

The `index`, `patch`, and `destroy` actions SHALL scope reads and writes by `user_id` for non-admin users. Admins continue to act across all lists. This behavior is unchanged from the current surface and is restated here so it remains testable after the rewrite.

#### Scenario: Non-admin cannot patch another user's list

- **WHEN** a non-admin user sends `PATCH /lists/:id` for a list owned by a different user
- **THEN** the server responds `404` and does not modify the row

#### Scenario: Admin can patch any list

- **WHEN** an admin user sends `PATCH /lists/:id` for any list
- **THEN** the server applies the patch if the precondition matches, regardless of `user_id`

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

### Requirement: Merge list into list via sidebar drag

The `/lists` sidebar list rows SHALL be draggable as list sources. Dropping one list onto a different list SHALL copy every item of the source list into the target list, appended after the target's existing items, and SHALL leave the source list unchanged. Each copied item MUST receive a fresh unique id and MUST preserve its `done`, `priority`, `due`, `tags`, and `updatedAt` values. The target's `updated_at` MUST be bumped. The merge SHALL be gated by a confirmation prompt; declining MUST leave both lists unchanged. The client SHALL issue `POST /lists/:sourceId/merge` with a JSON body `{ targetId }` and a valid CSRF token, and SHALL send the source's last-known `updated_at` as `If-Match` (or the `_if_match` body fallback). Per-user ownership MUST be enforced: a non-admin user MAY merge only between lists they own; an admin MAY merge between any lists.

#### Scenario: Drop a list onto another list copies its items

- **WHEN** the user drags list `A` and drops it on the sidebar row for list `B`, then confirms the prompt
- **THEN** list `B` contains all of its previous items followed by a copy of every item of list `A`
- **AND** the client reloads the frame so the sidebar counts and editor re-read from the server

#### Scenario: Copied items get fresh ids and the source is unchanged

- **WHEN** list `A` with items `[x, y]` (ids `ax, ay`) is merged into list `B`
- **THEN** the items appended to list `B` have new unique ids distinct from `ax` and `ay`
- **AND** list `A` still contains items `[x, y]` with ids `ax, ay` unchanged

#### Scenario: Declining the confirmation leaves both lists unchanged

- **WHEN** the user drops list `A` on list `B` and dismisses the confirmation prompt
- **THEN** neither list is modified and no merge request is sent

#### Scenario: Dropping a list on itself is rejected

- **WHEN** the user drops list `A` on its own sidebar row
- **THEN** the server responds `400` and the list is not modified

#### Scenario: Merging an empty source is rejected

- **WHEN** the user merges a list that has no items
- **THEN** the server responds `400` and the target is not modified

#### Scenario: Foreign list merge forbidden

- **WHEN** a non-admin user merges a list they own into a list owned by another user
- **THEN** the server responds `404` and neither list is modified

#### Scenario: Stale source precondition rejected

- **WHEN** the client sends a merge whose `If-Match` does not match the source row's current `updated_at`
- **THEN** the server responds `409` with the current source row and does not modify either list

#### Scenario: Missing precondition rejected

- **WHEN** the client sends a merge without an `If-Match` header and without an `_if_match` body field
- **THEN** the server responds `400` and does not modify either list

### Requirement: Move gesture feedback

During a drag, the sidebar rows SHALL render an explicit drop highlight when hovered, and the intra-list reorder indicator (border above/below a target row) and the cross-list sidebar highlight MUST be mutually exclusive — hovering a sidebar row SHALL suppress the intra-list indicator and vice versa.

#### Scenario: Sidebar row highlight on hover

- **WHEN** a drag is in progress and the pointer enters a sidebar row
- **THEN** that row is visually highlighted as a valid drop target and no intra-list reorder border is shown

#### Scenario: Reorder indicator returns over the editor

- **WHEN** a drag is in progress and the pointer leaves the sidebar and re-enters the item list
- **THEN** the intra-list reorder indicator logic applies again and no sidebar row remains highlighted

### Requirement: Merge gesture feedback

During a list drag, valid target sidebar rows SHALL render an explicit drop highlight when hovered, and the dragged source row MUST NOT be highlighted as a target. The sidebar highlight and the intra-list reorder indicator MUST remain mutually exclusive.

#### Scenario: Valid target highlighted during list drag

- **WHEN** a list drag is in progress and the pointer enters a sidebar row other than the source
- **THEN** that row is visually highlighted as a valid drop target

#### Scenario: Source row is not a target

- **WHEN** a list drag is in progress and the pointer is over the source row
- **THEN** the source row is not highlighted as a drop target
