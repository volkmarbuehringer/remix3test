## MODIFIED Requirements

### Requirement: Client grid auto-refresh after CRUD

When a create, update, or delete operation completes on the client grid, the grid frame SHALL automatically reload to reflect the change without a full page navigation.

#### Scenario: Grid refreshes after edit save

- **WHEN** user edits a client row and saves
- **THEN** the page redirects to `/admin/clients`
- **AND** the client grid frame SHALL reload its content automatically
- **AND** the sort, filter, and pagination state SHALL be preserved

#### Scenario: Grid refreshes after delete

- **WHEN** user deletes a client row
- **THEN** the page redirects to `/admin/clients`
- **AND** the client grid frame SHALL reload its content automatically

#### Scenario: Grid refreshes after create

- **WHEN** user creates a new client record
- **THEN** the page redirects to `/admin/clients`
- **AND** the client grid frame SHALL reload its content automatically
