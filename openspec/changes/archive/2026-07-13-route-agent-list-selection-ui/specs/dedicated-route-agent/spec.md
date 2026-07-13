## ADDED Requirements

### Requirement: Agent uses ids-filtered sidebar for multi-result selection

When `findList` returns multiple matching lists, the route agent SHALL navigate the lists frame to `/lists?ids=<comma-separated-ids>` so the user can pick from the sidebar UI. The agent SHALL NOT use `askUserTool` for list selection when multiple results exist — the sidebar is the selection surface.

#### Scenario: Multi-result navigates to ids-filtered lists page
- **WHEN** the agent calls `findList` and receives 3 matching list IDs
- **THEN** the agent SHALL call `routeNavigate` with path `/lists?ids=1,5,12` (reflecting the actual IDs)
- **AND** the agent SHALL NOT call `askUserTool` for list selection

### Requirement: Agent navigates directly on single result

When `findList` returns exactly one matching list, the agent SHALL navigate directly to that list via `routeNavigate("/lists?load=<id>")` to avoid an unnecessary sidebar filter step.

#### Scenario: Single result skips sidebar filter
- **WHEN** the agent calls `findList` and receives exactly 1 matching list with ID 42
- **THEN** the agent SHALL call `routeNavigate` with path `/lists?load=42`

### Requirement: Agent uses askUserTool only when findList returns zero results

When `findList` returns no matching lists, the agent SHALL use `askUserTool` to inform the user and offer alternatives (e.g., different search terms, browsing all lists).

#### Scenario: No results triggers askUserTool
- **WHEN** the agent calls `findList` and receives zero results
- **THEN** the agent SHALL call `askUserTool` with a question explaining no lists were found and suggesting next steps
