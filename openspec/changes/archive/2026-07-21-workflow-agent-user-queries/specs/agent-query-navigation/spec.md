## ADDED Requirements

### Requirement: Agent navigates to users grid for user queries

When the admin asks a general question about users (not a specific workflow action), the workflow agent SHALL use the `navigate` tool to show the admin users grid with an appropriate filter.

The agent SHALL map natural language to filter parameters as follows:
- `disabled` / `locked` / `gesperrt` / `deaktiviert` → `filter=disabled`
- `active` / `enabled` / `aktiv` → `filter=enabled`
- Any name or email text → `filter=<text>`
- No specific filter → no filter param (shows all users)

The agent MUST NOT call `ask_user` after query-driven navigation.

#### Scenario: Ask for locked users
- **WHEN** admin asks "which users are locked" or "wer ist gesperrt"
- **THEN** agent calls `navigate({path: '/admin/users', query: {filter: 'disabled'}})`
- **AND** does NOT call `ask_user`

#### Scenario: Ask for active users
- **WHEN** admin asks "show me active users"
- **THEN** agent calls `navigate({path: '/admin/users', query: {filter: 'enabled'}})`

#### Scenario: Search by name
- **WHEN** admin asks "find user named Max" or "show me user Smith"
- **THEN** agent calls `navigate({path: '/admin/users', query: {filter: 'Max'}})` (or `Smith`)

#### Scenario: Search by email
- **WHEN** admin asks "find user with email john@example.com"
- **THEN** agent calls `navigate({path: '/admin/users', query: {filter: 'john@example.com'}})`

#### Scenario: Show all users
- **WHEN** admin asks "show me all users" or "list users"
- **THEN** agent calls `navigate({path: '/admin/users'})`

#### Scenario: User query does not trigger ask_user
- **WHEN** admin asks a user query and agent calls `navigate`
- **THEN** agent responds with a brief confirmation text only
- **AND** does NOT call `ask_user`

#### Scenario: Workflow still follows existing protocol
- **WHEN** admin asks "lock user 5" or "cancel user 42"
- **THEN** agent follows the existing workflow protocol (navigate + ask_user + execute)
- **AND** the query rules do not override workflow rules
