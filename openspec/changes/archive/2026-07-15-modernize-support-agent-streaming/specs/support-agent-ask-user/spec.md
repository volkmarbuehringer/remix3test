## ADDED Requirements

### Requirement: ask_user tool definition

The support agent SHALL have an `ask_user` tool that allows it to ask the admin a question with optional multiple-choice options.

#### Scenario: Tool available to agent

- **WHEN** the support agent processes a message
- **THEN** the `ask_user` tool SHALL be available in its toolset

### Requirement: Free-text question

The agent SHALL be able to ask the admin a free-text question when it needs clarification.

#### Scenario: Agent asks free-text question

- **WHEN** the agent needs a clarification not covered by options
- **THEN** the tool SHALL accept a `question` string and emit it without options
- **AND** the client SHALL show a prompt for free-text input

### Requirement: Multiple-choice question

The agent SHALL be able to present the admin with options to choose from, supporting both single-select and multi-select modes.

#### Scenario: Single-select question

- **WHEN** the agent needs the admin to choose one option
- **THEN** the tool SHALL accept `options` and set `selectionMode: 'single_select'`
- **AND** the client SHALL display radio buttons

#### Scenario: Multi-select question

- **WHEN** the agent needs the admin to choose multiple options
- **THEN** the tool SHALL accept `options` and set `selectionMode: 'multi_select'`
- **AND** the client SHALL display checkboxes

### Requirement: Agent instructions for disambiguation

The agent instructions SHALL guide the agent to use `ask_user` when input is ambiguous — for example, multiple users matching a name query, or an unclear date range.

#### Scenario: Ambiguous user name triggers question

- **WHEN** the admin searches for a name matching multiple users
- **THEN** the agent SHALL use `ask_user` to ask which user they meant, listing the matching IDs

#### Scenario: Clarifying date context

- **WHEN** the admin says "last week" or "recent"
- **THEN** the agent SHALL use the `get_current_date_time` tool to resolve the date
- **AND** SHALL NOT need `ask_user` for date context unless the date is still ambiguous
