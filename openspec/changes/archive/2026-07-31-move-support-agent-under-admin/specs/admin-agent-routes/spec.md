## Purpose

Serves the admin-only support-agent chat under the `/admin` route tree, rendered with the admin sidebar chrome, alongside workflow-agent and agent-events.

## ADDED Requirements

### Requirement: Support-agent routes served under /admin

The system SHALL serve the support-agent chat under the `/admin` path prefix.

#### Scenario: Admin accesses /admin/support-agent

- **WHEN** an authenticated admin user navigates to `/admin/support-agent`
- **THEN** the system SHALL render the Support-Agent page with the chat input box
- **AND** the response SHALL have status 200

#### Scenario: Panel endpoint served under /admin

- **WHEN** the panel frame content is requested at `/admin/support-agent/panel`
- **THEN** the system SHALL return the panel fragment

#### Scenario: Old top-level path no longer resolves

- **WHEN** any user navigates to `/mastra/chat`
- **THEN** the system SHALL NOT render the support-agent chat at that path (404 or redirect)

### Requirement: Support-agent page shows the admin sidebar

The system SHALL render the Support-Agent page inside the admin sidebar layout, not the public `MainNav` layout, and always include the chat input box.

#### Scenario: Support-Agent page shows the admin sidebar

- **WHEN** an admin user navigates to `/admin/support-agent` directly or via the admin sidebar
- **THEN** the admin sidebar SHALL be visible
- **AND** the Support-Agent nav item SHALL be highlighted

#### Scenario: Chat input is present on the page

- **WHEN** an admin user navigates to `/admin/support-agent` directly or via the admin sidebar
- **THEN** the chat input form SHALL be rendered
- **AND** submitting it SHALL stream the agent response into the page

### Requirement: Support-agent panel frame uses a unique name

The system SHALL name the nested panel frame `support-agent-panel` so sidebar frame navigation resolves to the page frame rather than the nested panel frame.

#### Scenario: Sidebar navigation from the support-agent page navigates the page frame

- **WHEN** an admin user clicks a sidebar nav item while on `/admin/support-agent`
- **THEN** the whole page frame SHALL navigate to the selected admin page
- **AND** the nested panel frame SHALL NOT be navigated

#### Scenario: SSE navigate events drive the panel frame

- **WHEN** the agent emits an SSE `navigate` event via `routeNavigate`
- **THEN** the client SHALL navigate the panel frame named `support-agent-panel` to the event href
