## ADDED Requirements

### Requirement: askUserTool SHALL be added to the customer agent

The customer agent SHALL have access to `askUserTool` from `@mastra/core/tools` for presenting structured choices to the user.

#### Scenario: askUserTool is in the agent's tool list
- **WHEN** the customer agent is initialized
- **THEN** `askUserTool` SHALL be included in the agent's `tools` object
- **AND** the agent instructions SHALL describe when and how to use it

#### Scenario: Agent instructions describe askUserTool usage
- **WHEN** the agent instructions mention structured choices
- **THEN** they SHALL instruct the agent to use `askUserTool` for:
  - Selecting between multiple matching resources
  - Choosing an alternative resource when no slots are available
  - Asking whether to book another appointment after a successful booking
  - Any other ambiguous choice that benefits from structured options

### Requirement: confirm_resource SHALL lose requireApproval

The `confirm_resource` tool SHALL no longer use `requireApproval: true`. Its function SHALL be replaced by the agent using `askUserTool` to present resource options to the customer.

#### Scenario: confirm_resource has no requireApproval
- **WHEN** the customer agent calls `confirm_resource`
- **THEN** the tool SHALL NOT trigger a system suspend
- **AND** the tool SHALL execute immediately
- **AND** `confirm_resource` SHALL remain as a lightweight "acknowledge the selection" tool (or be removed if no longer needed)

#### Scenario: Resource selection uses askUserTool instead
- **WHEN** the agent finds multiple matching resources
- **THEN** the agent SHALL use `askUserTool` with the matching resources as radio options
- **AND** SHALL present a question like "Ich habe mehrere passende Ressourcen gefunden. Welche spricht Sie am meisten an?"
- **AND** SHALL include the resource name and a brief description in each option
- **WHEN** the user selects a resource via the question card
- **THEN** the agent SHALL proceed to call `find_next_available_slots` for the selected resource

### Requirement: Post-booking question SHALL use askUserTool

After a successful booking, the agent SHALL use `askUserTool` to ask the customer if they want another booking, replacing the current `postBookingDecision` session flash mechanism.

#### Scenario: Post-booking question via askUserTool
- **WHEN** a booking succeeds
- **THEN** the agent SHALL use `askUserTool` to present "Möchten Sie einen weiteren Termin buchen?" with options "Ja, weitermachen" and "Nein, fertig"
- **AND** the controller SHALL NOT use `session.flash('postBookingDecision', ...)`
- **AND** the controller SHALL NOT render the old post-booking decision card

### Requirement: No-slot fallback SHALL use askUserTool

When a resource has no available slots, the agent SHALL use `askUserTool` to offer alternative resources instead of ending the conversation.

#### Scenario: No-slot fallback with askUserTool
- **WHEN** `find_next_available_slots` returns no slots
- **THEN** the agent SHALL check if there are other matching resources from the previous search
- **AND** SHALL use `askUserTool` to ask "Leider keine freien Termine für [Resource]. Möchten Sie eine andere probieren?" with the remaining resources as options
- **AND** if no other resources remain, SHALL inform the customer and end the conversation naturally
