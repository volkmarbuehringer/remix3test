## ADDED Requirements

### Requirement: Persistent conversation display
The agent SHALL display all user messages and agent responses as a scrollable conversation history. New messages SHALL NOT overwrite previous messages.

#### Scenario: User sends a message
- **WHEN** the admin types a message and submits the form
- **THEN** a right-aligned user bubble appears in the conversation container with the message text
- **AND** a new agent bubble appears below it showing the streaming response

#### Scenario: Page is not refreshed between interactions
- **WHEN** the agent completes an action and the admin sends a second message
- **THEN** the first conversation pair (user + agent) remains visible
- **AND** a new user bubble and agent bubble appear below the previous ones

### Requirement: Inline tool approval UI
The agent SHALL render approve/decline buttons for tool suspension events, with semantic coloring (red for destructive actions, blue for others).

#### Scenario: Destructive tool suspension
- **WHEN** the agent calls a destructive tool requiring approval (e.g., `cancel_user_workflow_v2`)
- **THEN** the agent bubble shows a red warning message with the tool name and target info
- **AND** a red "✔ Confirm" button and a gray "✖ Decline" button are rendered
- **WHEN** the admin clicks "✔ Confirm"
- **THEN** the form is disabled and a POST is sent to `/workflow-agent/tool-decision` with decision `approve`

#### Scenario: Non-destructive tool suspension
- **WHEN** the agent calls a non-destructive tool requiring approval
- **THEN** the agent bubble shows a blue-tinted approval prompt
- **AND** "✔ Approve" and "✖ Decline" buttons are rendered

### Requirement: Frame auto-reload on completion
The agent SHALL reload the active Frame when the stream completes if no navigation occurred during the interaction.

#### Scenario: Action without navigation
- **WHEN** the agent completes a response and the stream finishes
- **AND** no navigation event was sent during the stream
- **THEN** the currently active frame SHALL be reloaded to reflect any data changes

#### Scenario: Action with navigation
- **WHEN** the agent completes a response and the stream finishes
- **AND** a navigation event was sent during the stream
- **THEN** the frame SHALL NOT be reloaded (the navigation already updated it)

### Requirement: Tool-error event display
The agent SHALL render tool error events as visible error messages in the conversation.

#### Scenario: Tool execution fails
- **WHEN** a tool returns an error during agent execution
- **THEN** the conversation SHALL display an error message in italic red text showing the error description

### Requirement: Protocol-adherence scoring
The agent SHALL evaluate its own responses for protocol compliance, checking that required workflow steps were followed.

#### Scenario: Agent skips consistency checks
- **WHEN** the agent performs a destructive action (lock/cancel/unlock)
- **AND** the agent does not call `run_consistency_checks` afterward
- **THEN** the scorer SHALL flag the response as incomplete

#### Scenario: Agent generates action report
- **WHEN** the agent performs a destructive action
- **AND** the agent does not call `generate_action_report` as the final step
- **THEN** the scorer SHALL flag the response as incomplete

### Requirement: Multi-line message input
The message input SHALL support multi-line text input with Enter to send and Shift+Enter for newlines.

#### Scenario: Enter sends message
- **WHEN** the admin types a message and presses Enter
- **THEN** the form SHALL submit immediately

#### Scenario: Shift+Enter inserts newline
- **WHEN** the admin types a message and presses Shift+Enter
- **THEN** a newline SHALL be inserted into the input
- **AND** the form SHALL NOT submit

### Requirement: PDF download in conversation
The agent SHALL render PDF download links inside the agent's message bubble, not as a separate UI element.

#### Scenario: Action report generated
- **WHEN** the agent generates an action report PDF
- **THEN** the PDF download link SHALL appear inside the agent's final message bubble
- **AND** the link SHALL trigger a download of the PDF when clicked
