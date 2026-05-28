## Purpose

How client entries can dynamically mount and unmount `<Frame>` components using boolean state, enabling lazy-loaded content panels without full-page navigation.

## Requirements

### Requirement: Client-mounted frame for AI agent results

The AI agent page SHALL support mounting and unmounting a `<Frame>` that displays agent execution results, controlled by client-side toggle state.

#### Scenario: Mount result frame on "Run Agent"

- **WHEN** user clicks "Run Agent" on the AI agent page
- **THEN** a `<Frame>` SHALL mount dynamically on the client side
- **AND** the frame SHALL load its content from the agent result endpoint
- **AND** a fallback loading indicator SHALL be shown while the frame content streams in
- **AND** the form submission SHALL NOT cause a full page navigation

#### Scenario: Unmount result frame on close

- **WHEN** user clicks a "Close" or "Clear" button on the mounted result frame
- **THEN** the frame SHALL unmount and its content SHALL be removed from the DOM
- **AND** the agent input form SHALL be available for a new submission

### Requirement: Client-mounted frame for admin chatlog detail

The admin chatlog page SHALL support mounting a detail `<Frame>` when the user clicks a chatlog row, without a full page navigation.

#### Scenario: Mount detail frame on row click

- **WHEN** user clicks a chatlog entry row
- **THEN** a detail `<Frame>` SHALL mount on the client side
- **AND** the frame SHALL load its content from the chatlog detail endpoint
- **AND** a fallback loading indicator SHALL be shown while the content loads
- **AND** other chatlog entries SHALL remain visible

#### Scenario: Unmount detail frame

- **WHEN** user clicks a "Close" or "Back" button on the detail frame
- **THEN** the detail frame SHALL unmount
- **AND** the chatlog list SHALL be fully visible again
