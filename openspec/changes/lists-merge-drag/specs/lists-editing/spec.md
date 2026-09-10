## ADDED Requirements

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

### Requirement: Merge gesture feedback

During a list drag, valid target sidebar rows SHALL render an explicit drop highlight when hovered, and the dragged source row MUST NOT be highlighted as a target. The sidebar highlight and the intra-list reorder indicator MUST remain mutually exclusive.

#### Scenario: Valid target highlighted during list drag

- **WHEN** a list drag is in progress and the pointer enters a sidebar row other than the source
- **THEN** that row is visually highlighted as a valid drop target

#### Scenario: Source row is not a target

- **WHEN** a list drag is in progress and the pointer is over the source row
- **THEN** the source row is not highlighted as a drop target

## MODIFIED Requirements

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

### Requirement: Dead show route removed

The route map MUST NOT include a `lists.show` action, the controller MUST NOT define a `show` handler, and the file `app/actions/lists/show-page.tsx` MUST NOT exist.

#### Scenario: No show route in route map

- **WHEN** the route map is inspected
- **THEN** the `lists` route contains only `index`, `create`, `update`, `destroy`, `move`, `copy`, and `merge`
- **AND** no `lists.show` reference exists in `app/`
