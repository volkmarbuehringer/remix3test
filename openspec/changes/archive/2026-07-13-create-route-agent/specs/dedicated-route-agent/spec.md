## ADDED Requirements

### Requirement: Dedicated route agent with minimal toolset

The system SHALL provide a Mastra agent (`routeAgent`) exposed via `mastra.getAgent('routeAgent')` that has only the tools `routeNavigate`, `findList`, and `askUserTool`. The agent SHALL NOT carry any workspace, workspace tools, or filesystem-access tools.

#### Scenario: Agent has routeNavigate tool

- **WHEN** the agent is instantiated
- **THEN** `routeNavigate` SHALL be available as a tool
- **AND** calling `routeNavigate` with a valid path SHALL return `{ type: 'route', path }`

#### Scenario: Agent has findList tool

- **WHEN** the agent is instantiated
- **THEN** `findList` SHALL be available as a tool
- **AND** calling `findList` with a search term SHALL return matching list results from the database

#### Scenario: Agent has askUserTool

- **WHEN** the agent is instantiated
- **THEN** `askUserTool` SHALL be available as a tool
- **AND** calling `askUserTool` SHALL suspend the agent until the user provides an answer

#### Scenario: Agent has no workspace tools

- **WHEN** the agent is instantiated
- **THEN** the agent SHALL NOT have a `workspace` property
- **AND** no `mastra_workspace_*` tools SHALL be available

#### Scenario: Agent is registered in Mastra index

- **WHEN** `mastra.getAgent('routeAgent')` is called
- **THEN** the route agent SHALL be returned
- **AND** it SHALL have id `route-agent`

### Requirement: Route-agent controller uses dedicated agent

The route-agent controller (`app/actions/route-agent/controller.tsx`) SHALL use `mastra.getAgent('routeAgent')` instead of `mastra.getAgent('testAgent')`. The `requireApproval` callback SHALL be removed.

#### Scenario: Controller action uses routeAgent

- **WHEN** a POST request is sent to `/route-agent`
- **THEN** the controller SHALL call `mastra.getAgent('routeAgent')`
- **AND** SHALL call the agent's `stream()` method

#### Scenario: No requireApproval needed

- **WHEN** the route-agent processes a tool call
- **THEN** no `requireApproval` callback SHALL be passed to `stream()`
- **AND** the controller SHALL rely only on `askUserTool` suspension for user interaction
