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

### Requirement: Agent requires MIME-type confirmation before upload navigation

The route agent SHALL ask the user to select a MIME type before navigating to `/uploads`. The agent SHALL navigate only if the user selects "PDF".

#### Scenario: Agent asks MIME type before /uploads navigation
- **WHEN** the user asks to view uploads or navigate to `/uploads`
- **THEN** the agent SHALL call `askUserTool` with a question about the desired MIME type
- **AND** the options SHALL include "PDF", "JPEG", and "PNG" with descriptions
- **AND** `selectionMode` SHALL be `"single_select"`

#### Scenario: PDF confirmed → navigates to /uploads
- **WHEN** the user selects "PDF" in response to the MIME-type question
- **THEN** the agent SHALL call `routeNavigate('/uploads')`

#### Scenario: Non-PDF selected → returns text response
- **WHEN** the user selects "JPEG" or "PNG" in response to the MIME-type question
- **THEN** the agent SHALL NOT call `routeNavigate`
- **AND** SHALL return a text message informing the user that only PDF uploads are supported
