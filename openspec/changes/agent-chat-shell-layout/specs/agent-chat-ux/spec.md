## ADDED Requirements

### Requirement: Chat page fills available space
The agent chat page SHALL size itself to the available content area of the admin layout rather than the full viewport height, so the page does not produce a vertical scrollbar on initial load and the message input remains visible.

#### Scenario: Page loads without scrollbar
- **WHEN** an admin navigates to an agent chat page (e.g. `/admin/workflowagent2`)
- **AND** the page has no messages or events yet
- **THEN** the page SHALL fit within the visible content area with no page-level vertical scrollbar

#### Scenario: Input bar remains visible
- **WHEN** the chat page is displayed
- **THEN** the message input bar SHALL be pinned to the bottom of the visible content area
- **AND** the conversation/frame area SHALL absorb any available space above it

## MODIFIED Requirements

### Requirement: Multi-line message input
The message input SHALL support multi-line text input with Enter to send and Shift+Enter for newlines. The input SHALL render with a visible default height of at least two lines, grow taller as the message text wraps, and scroll internally beyond a maximum height.

#### Scenario: Enter sends message
- **WHEN** the admin types a message and presses Enter
- **THEN** the form SHALL submit immediately

#### Scenario: Shift+Enter inserts newline
- **WHEN** the admin types a message and presses Shift+Enter
- **THEN** a newline SHALL be inserted into the input
- **AND** the form SHALL NOT submit

#### Scenario: Multi-line input is visible by default
- **WHEN** the chat page is displayed
- **THEN** the message input SHALL render tall enough to show at least two lines of text

#### Scenario: Input grows with content
- **WHEN** the admin types a message that wraps beyond the input's default height
- **THEN** the input SHALL grow to fit the message content
- **AND** the input SHALL stop growing and scroll internally once it reaches its maximum height

#### Scenario: Input height resets after send
- **WHEN** the admin submits a message
- **THEN** the input SHALL be cleared
- **AND** the input SHALL return to its default height
