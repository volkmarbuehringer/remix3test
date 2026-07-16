## ADDED Requirements

### Requirement: Lists index action accepts ids query parameter

The lists controller's `index` action SHALL accept a `?ids=` query parameter containing a comma-separated list of list IDs. When present, the sidebar SHALL display only those lists (scoped by user ownership), ignoring `filter`, `offset`, and `limit` parameters. Non-numeric or non-existent IDs SHALL be silently omitted. The order of the sidebar entries SHALL match the order of the IDs in the `ids` parameter. The "Neue Liste" nav link SHALL always be shown regardless of the `ids` filter.

#### Scenario: ids param shows only matching lists

- **WHEN** the user navigates to `/lists?ids=1,5,12` and lists 1, 5, 12 exist and belong to the current user
- **THEN** the sidebar SHALL show exactly list 1, list 5, and list 12 in that order
- **AND** the `filter`, `offset`, and `limit` parameters SHALL be ignored

#### Scenario: Non-existent id is omitted

- **WHEN** the user navigates to `/lists?ids=1,9999` and list 9999 does not exist
- **THEN** the sidebar SHALL show only list 1 (the non-existent ID is silently omitted)

#### Scenario: Non-numeric ids are ignored

- **WHEN** the user navigates to `/lists?ids=1,abc,5`
- **THEN** the sidebar SHALL show list 1 and list 5 (the non-numeric `abc` is ignored)

#### Scenario: ids param respects user ownership

- **WHEN** a non-admin user navigates to `/lists?ids=1,2` and list 2 belongs to another user
- **THEN** the sidebar SHALL show only list 1

#### Scenario: Neue Liste link always visible

- **WHEN** the sidebar is filtered via `ids` parameter
- **THEN** the "Neue Liste" nav link SHALL still be shown at the top of the sidebar

#### Scenario: Sidebar click drops ids param

- **WHEN** the user clicks a list entry in the `ids`-filtered sidebar
- **THEN** the target URL SHALL be `/lists?load=<id>` (without `ids` parameter)
- **AND** the sidebar SHALL reload with the user's full paginated list set

### Requirement: Agent navigates to ids-filtered sidebar on multi-result

When the route agent receives multiple results from `findList`, it SHALL navigate the frame to `/lists?ids=<comma-separated-ids>` so the user can pick from the sidebar. The agent SHALL NOT use `askUserTool` for list selection when multiple results exist.

#### Scenario: Multi-result navigates to ids-filtered lists page

- **WHEN** `findList` returns 3 matching lists with IDs 1, 5, and 12
- **THEN** the agent SHALL call `routeNavigate` with path `/lists?ids=1,5,12`
- **AND** the sidebar SHALL show only those 3 lists for the user to pick

#### Scenario: Single-result navigates directly to the list

- **WHEN** `findList` returns exactly 1 matching list with ID 42
- **THEN** the agent SHALL call `routeNavigate` with path `/lists?load=42`
- **AND** the sidebar SHALL show the full paginated list set with list 42 highlighted

#### Scenario: Zero results uses askUserTool

- **WHEN** `findList` returns no matching lists
- **THEN** the agent SHALL use `askUserTool` to inform the user and suggest alternatives
