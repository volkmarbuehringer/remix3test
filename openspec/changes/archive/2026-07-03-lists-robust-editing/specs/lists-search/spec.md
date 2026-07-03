## ADDED Requirements

### Requirement: User sidebar search

The user-facing `/lists` sidebar SHALL include a search input. Typing into it updates the frame's `src` with a `?filter=<value>` query parameter (client-side debounced ~250 ms). The `index` action SHALL forward `filter` to `getAllLists`, which filters by `description ILIKE` or any `item->>'label' ILIKE` within the jsonb `list` array. Scoping by `user_id` for non-admin users is preserved.

#### Scenario: Filter narrows the sidebar

- **WHEN** the user types "einkauf" into the sidebar search input
- **THEN** the frame src becomes `/lists?filter=einkauf` (the previously active `?load=` value is dropped)
- **AND** the server returns only lists whose `description` or any item label matches `einkauf` case-insensitively

#### Scenario: Empty filter restores full list

- **WHEN** the user clears the search input
- **THEN** the frame src returns to `/lists` (no `filter` param)
- **AND** the server returns the unfiltered, paginated list

#### Scenario: Filter respects user ownership

- **WHEN** a non-admin user types a filter that would match another user's list description
- **THEN** the server does not return that list, because the `user_id` scope is applied alongside the filter

#### Scenario: Long filter is truncated

- **WHEN** the user types a filter longer than 200 characters
- **THEN** the server truncates the filter to 200 characters before applying it (existing `getAllLists` behavior, restated for testability)

### Requirement: Filter does not alter write semantics

The presence of `?filter=` on the frame URL MUST NOT affect the behavior of `create`, `patch`, or `destroy` actions. After a write, the redirect / reload SHALL preserve the active `?load=` and may drop `?filter=` so the just-edited list remains visible in the sidebar.

#### Scenario: Save while filter active keeps the active list loaded

- **WHEN** the user saves an edit while `?filter=foo&load=42` is in the frame URL
- **THEN** the post-save reload sets `?load=42` (without `filter=foo`)
- **AND** the sidebar shows the unfiltered set so the user can confirm the saved list is present