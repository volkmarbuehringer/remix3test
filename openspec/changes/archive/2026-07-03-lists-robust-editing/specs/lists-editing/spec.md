## ADDED Requirements

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

The system SHALL expose exactly three write actions on the session-auth `/lists` route map: `create` (`POST /`), `patch` (`PATCH /:id`), and `destroy` (`POST /:id/delete`). The previous `save`, `update`, `rename`, and `data` actions MUST be removed.

#### Scenario: Create a new list

- **WHEN** the client sends `POST /lists` with a JSON body `{ description, items }` and a valid CSRF token
- **THEN** the server creates the list, assigns stable ids to every item, and responds `200` with `{ id, description, items, updated_at }`

#### Scenario: Patch replaces only the supplied fields

- **WHEN** the client sends `PATCH /lists/:id` with body `{ description }`
- **THEN** the server updates only `description` and `updated_at`; the `items` array is unchanged

- **WHEN** the client sends `PATCH /lists/:id` with body `{ items }`
- **THEN** the server updates only `items` (preserving any item ids the client sent, assigning ids to new ones) and `updated_at`; `description` is unchanged

- **WHEN** the client sends `PATCH /lists/:id` with an empty body (neither `description` nor `items`)
- **THEN** the server responds `400` with an error indicating at least one field is required

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
- **THEN** the `lists` route contains only `index`, `create`, `patch`, and `destroy`
- **AND** no `lists.show` reference exists in `app/`

### Requirement: Per-user ownership scoping preserved

The `index`, `patch`, and `destroy` actions SHALL scope reads and writes by `user_id` for non-admin users. Admins continue to act across all lists. This behavior is unchanged from the current surface and is restated here so it remains testable after the rewrite.

#### Scenario: Non-admin cannot patch another user's list

- **WHEN** a non-admin user sends `PATCH /lists/:id` for a list owned by a different user
- **THEN** the server responds `404` and does not modify the row

#### Scenario: Admin can patch any list

- **WHEN** an admin user sends `PATCH /lists/:id` for any list
- **THEN** the server applies the patch if the precondition matches, regardless of `user_id`