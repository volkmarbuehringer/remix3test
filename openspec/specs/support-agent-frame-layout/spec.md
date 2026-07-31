## Purpose

The support-agent chat is served under `/admin/support-agent` with a single primary panel frame occupying the flex space above the chat and input bars, matching the route-agent layout pattern.

## Requirements

### Requirement: Frame-as-primary viewport layout

The support agent page SHALL use a single primary panel frame occupying the flex space above the chat and input bars. The chat-thread frame SHALL be removed.

#### Scenario: Full-page layout has primary panel frame

- **WHEN** the support agent page is rendered
- **THEN** the layout SHALL consist of a primary `<Frame>` element (flex: 1), the chat messages area, and an input bar
- **AND** there SHALL be no chat-thread frame visible

#### Scenario: Primary panel frame defaults to placeholder

- **WHEN** the support agent page first loads and no navigation has occurred
- **THEN** the primary panel frame SHALL display a placeholder prompt, e.g. "Frage zu Benutzern, Terminen und Systemdaten..."
- **AND** the placeholder SHALL NOT be a chat thread

### Requirement: Frame target naming

The support agent page SHALL use the frame target name `support-agent-panel` for its primary panel frame, and the admin sidebar layout SHALL register it as a content-only target.

#### Scenario: Panel frame is named support-agent-panel

- **WHEN** the support agent primary frame is created
- **THEN** its `name` attribute SHALL be `support-agent-panel`
- **AND** its `data-active-frame` container attribute SHALL be `support-agent-panel`

#### Scenario: Panel target renders content-only

- **WHEN** the support agent panel frame loads an admin route with `X-Remix-Target: support-agent-panel`
- **THEN** the admin layout SHALL render only the page content without the sidebar shell

### Requirement: Rendered with the admin sidebar

The support agent page SHALL render inside the admin sidebar layout, with the chat input bar always present.

#### Scenario: Direct access renders the admin sidebar

- **WHEN** an admin navigates directly to `/admin/support-agent`
- **THEN** the admin sidebar SHALL be visible
- **AND** the primary panel frame and chat input bar SHALL be rendered

#### Scenario: Sidebar access renders the same page

- **WHEN** an admin navigates to `/admin/support-agent` via the admin sidebar
- **THEN** the same Support-Agent page SHALL be rendered with the chat input bar
