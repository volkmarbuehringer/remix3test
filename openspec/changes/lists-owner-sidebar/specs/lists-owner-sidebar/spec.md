## ADDED Requirements

### Requirement: /lists renders a sidebar layout

The `/lists` index route SHALL render a two-column layout produced by the shared `createSidebarLayout` factory (the same mechanism used by `/admin`): a sticky left sidebar and a content area. This gives `/lists` the same sidebar chrome as `/admin`.

#### Scenario: Authenticated user visits /lists

- **WHEN** an authenticated user issues `GET /lists`
- **THEN** the response renders the shared sidebar layout shell with a sidebar on the left and the list editor content area on the right

#### Scenario: Unauthenticated user visits /lists

- **WHEN** an unauthenticated user issues `GET /lists`
- **THEN** the request is rejected by the existing `requireAuth` middleware (no sidebar layout is rendered)

### Requirement: Sidebar lists the current user's saved lists

The sidebar SHALL display one entry per list owned by the current user, ordered by most-recently-updated first. Each entry SHALL show the list's description as its label and an item-count badge. Non-admin users SHALL see only lists they created; admin users SHALL see all lists.

#### Scenario: Non-admin user with saved lists

- **WHEN** a non-admin user with lists `A` (theirs) and `B` (another user's) opens `/lists`
- **THEN** the sidebar shows an entry for list `A` and no entry for list `B`

#### Scenario: Admin user sees all lists

- **WHEN** an admin user opens `/lists`
- **THEN** the sidebar shows an entry for every list regardless of owner

#### Scenario: User with no saved lists

- **WHEN** a user with no saved lists opens `/lists`
- **THEN** the sidebar shows only the "New list" entry and the content area shows the empty editor

### Requirement: Clicking a sidebar entry loads that list for editing

Selecting a sidebar entry SHALL load the corresponding list into the editor for editing, reusing the existing `GET /lists/:id/data` flow. Navigation SHALL target the lists content frame so the sidebar does not reload.

#### Scenario: User clicks a saved list in the sidebar

- **WHEN** the user clicks the sidebar entry for list `#5`
- **THEN** the editor content area loads list `#5`'s items and description from `GET /lists/5/data` and that sidebar entry becomes the active/highlighted entry

#### Scenario: User loads a list not owned by them

- **WHEN** a non-admin user opens `/lists?load=<id>` where `<id>` belongs to another user
- **THEN** `GET /lists/<id>/data` returns `404` (existing owner-scoping) and the editor shows a not-found/error state rather than another user's data

### Requirement: Active list is highlighted in the sidebar

The sidebar entry whose id matches the list currently loaded for editing SHALL be visually marked as active. When no list is loaded (new/empty editor), the "New list" entry SHALL be active.

#### Scenario: A list is loaded for editing

- **WHEN** `/lists?load=7` is rendered and list `#7` exists in the sidebar
- **THEN** the entry for list `#7` is highlighted as active and all other entries are inactive

#### Scenario: No list loaded

- **WHEN** `/lists` is rendered without a `load` query parameter
- **THEN** the "New list" entry is highlighted as active

### Requirement: New list entry clears the editor

The sidebar SHALL include a "New list" entry that, when selected, clears the editor's items and description so the user can start a fresh list. This SHALL NOT delete any saved list.

#### Scenario: User starts a new list after editing an existing one

- **WHEN** the user has list `#7` loaded and clicks "New list"
- **THEN** the editor's items and description are cleared, `loadedListId` becomes `null`, and the "Update" button is disabled until a new save creates a row
