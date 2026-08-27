## MODIFIED Requirements

### Requirement: Agent routes served under /admin

The system SHALL serve the workflow-agent and agent-events pages under the `/admin` path prefix.

#### Scenario: Admin accesses /admin/workflow-agent

- **WHEN** an authenticated admin user navigates to `/admin/workflow-agent`
- **THEN** the system SHALL render the Workflow-Agent page
- **AND** the response SHALL have status 200

#### Scenario: Admin accesses /admin/workflowagent2

- **WHEN** an authenticated admin user navigates to `/admin/agent-events`
- **THEN** the system SHALL render the Agent-Events page
- **AND** the response SHALL have status 200

#### Scenario: Panel endpoints served under /admin

- **WHEN** the panel frame content is requested at `/admin/workflow-agent/panel` or `/admin/agent-events/panel`
- **THEN** the system SHALL return the panel fragment

#### Scenario: Old top-level paths no longer resolve

- **WHEN** an unauthenticated or authenticated user navigates to `/workflow-agent` or `/agent-events`
- **THEN** the system SHALL NOT render the agent pages at those paths (404 or redirect)

#### Scenario: Legacy agent-events path no longer resolves

- **WHEN** an authenticated admin user navigates to the former `/admin/workflowagent2` path
- **THEN** the system SHALL NOT render the Agent-Events page at that path (404 or redirect)

### Requirement: Admin sidebar rendered on agent pages

The system SHALL render the Workflow-Agent and Agent-Events pages inside the admin sidebar layout, not the public `MainNav` layout.

#### Scenario: Agent pages show the admin sidebar

- **WHEN** an admin user navigates to `/admin/workflow-agent` or `/admin/agent-events`
- **THEN** the admin sidebar SHALL be visible
- **AND** the Workflow-Agent / Agent-Events nav item SHALL be highlighted

#### Scenario: Non-admin is rejected from agent routes

- **WHEN** an authenticated non-admin user navigates to `/admin/workflow-agent` or `/admin/agent-events`
- **THEN** the system SHALL return a 403 or redirect away

#### Scenario: Unauthenticated user is redirected from agent routes

- **WHEN** an unauthenticated user navigates to `/admin/workflow-agent` or `/admin/agent-events`
- **THEN** the system SHALL redirect to the login page

### Requirement: Panel frames use unique names

The system SHALL name the nested panel frames `workflow-agent-panel` and `agent-events-panel` so sidebar frame navigation resolves to the page frame rather than the nested panel frame.

#### Scenario: Sidebar navigation from an agent page navigates the page frame

- **WHEN** an admin user clicks a sidebar nav item while on `/admin/workflow-agent` or `/admin/agent-events`
- **THEN** the whole page frame SHALL navigate to the selected admin page
- **AND** the nested panel frame SHALL NOT be navigated

#### Scenario: SSE navigate events drive the panel frame

- **WHEN** the agent emits an SSE `navigate` event
- **THEN** the client SHALL navigate the panel frame named `workflow-agent-panel` or `agent-events-panel` to the event href
