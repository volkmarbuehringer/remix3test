## ADDED Requirements

### Requirement: Filter lists by item labels and description
The `/admin/lists` page SHALL provide a text search box that filters the displayed lists. The search SHALL match partial text against:
- The `description` column via `ILIKE`
- The `label` values of items inside the `list` JSONB array via `ILIKE` with `jsonb_array_elements()`

Search SHALL be case-insensitive.

#### Scenario: Filter finds matching description
- **WHEN** user enters "grocery" in the filter input and submits
- **THEN** the table SHALL show only lists whose description contains "grocery" (case-insensitive)

#### Scenario: Filter finds matching item label
- **WHEN** user enters "milk" in the filter input and submits
- **THEN** the table SHALL show only lists that contain at least one item whose label contains "milk" (case-insensitive)

#### Scenario: Empty filter shows all lists
- **WHEN** user clears the filter input and submits
- **THEN** the table SHALL show all lists (no filter applied)

#### Scenario: No matches shows empty state
- **WHEN** user enters a search term that matches no lists
- **THEN** the table SHALL render the empty state message

#### Scenario: Filter is preserved across pagination
- **WHEN** user applies a filter and clicks "Older →"
- **THEN** the next page SHALL apply the same filter

#### Scenario: Filter is preserved after delete
- **WHEN** user applies a filter and deletes a list
- **THEN** the redirect SHALL preserve the filter parameter

### Requirement: Filter input UI
The filter input SHALL be a text `<input>` inside a `<form>` with:
- `method="GET"`
- `action="/admin/lists"`
- `rmx-target` attribute set to the admin content frame
- A "Clear" link that appears when a filter is active, linking to `/admin/lists` without filter

#### Scenario: Filter form renders on page
- **WHEN** a user loads `/admin/lists`
- **THEN** the page SHALL contain an input field with placeholder text and a submit button

#### Scenario: Clear link appears when filter is active
- **WHEN** a user loads `/admin/lists?filter=milk`
- **THEN** the page SHALL show a "Clear" link that navigates to `/admin/lists`

### Requirement: GIN indexes on lists table
The database SHALL have two indexes on the `lists` table:
- `idx_lists_list` using `USING GIN (list jsonb_path_ops)`
- `idx_lists_desc` using `USING GIN (description gin_trgm_ops)` (requires `pg_trgm` extension)

These indexes SHALL be created in the database setup migration.

#### Scenario: Indexes exist after database setup
- **WHEN** the database is initialized
- **THEN** the `idx_lists_list` and `idx_lists_desc` indexes SHALL exist on the `lists` table
