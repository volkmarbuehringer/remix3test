## ADDED Requirements

### Requirement: Frame-as-primary viewport layout

The support agent full-page view SHALL use a single primary frame occupying the flex space above the agent bar and input bar, matching the route-agent layout pattern. The chat-thread frame SHALL be removed.

#### Scenario: Full-page layout has primary frame

- **WHEN** the support agent page is rendered as a full page (not inside the admin sidebar frame)
- **THEN** the layout SHALL consist of a primary `<Frame>` element (flex: 1), an agent bar, and an input bar
- **AND** there SHALL be no chat-thread frame visible

#### Scenario: Primary frame defaults to placeholder

- **WHEN** the support agent page first loads and no navigation has occurred
- **THEN** the primary frame SHALL display a placeholder prompt, e.g. "Frage zu Benutzern, Terminen und Systemdaten..."
- **AND** the placeholder SHALL NOT be a chat thread

#### Scenario: Admin-sidebar frame mode unchanged

- **WHEN** the support agent is rendered inside the admin sidebar frame (via X-Remix-Target header)
- **THEN** the existing `MastraChatPage` message UI SHALL be rendered without change
- **AND** the frame-as-primary layout SHALL NOT apply

### Requirement: Frame target naming

The support agent page SHALL use the frame target name `admin-content` for its primary frame, matching the target name used by the admin sidebar and route agent.

#### Scenario: Frame name is admin-content

- **WHEN** the support agent primary frame is created
- **THEN** its `name` attribute SHALL be `admin-content`
- **AND** its `data-active-frame` container attribute SHALL be `admin-content`
