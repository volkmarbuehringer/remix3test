## ADDED Requirements

### Requirement: Chat message accumulation
The system SHALL accumulate user messages and agent responses as individual DOM elements in a scrollable container instead of overwriting a single text slot.

#### Scenario: User submits a question
- **WHEN** user types a message in the input and submits the form
- **THEN** a user message element is appended to the chat history container with the message text

#### Scenario: Agent streams a response
- **WHEN** the agent begins streaming a response after user submission
- **THEN** an empty agent message element is appended to the chat history and its text content is updated incrementally as SSE message events arrive

#### Scenario: Multiple conversation turns
- **WHEN** the user submits a second message after a complete turn
- **THEN** both the first turn (user + agent messages) and the second turn are visible in the chat history

### Requirement: Scrollable chat container
The chat history container SHALL have a scrollbar when message content exceeds its visible height, with a minimum visible height of at least 3 message rows.

#### Scenario: Content overflows container
- **WHEN** enough messages accumulate to exceed the container's visible height
- **THEN** a vertical scrollbar appears allowing the user to scroll through all messages

#### Scenario: Auto-scroll during streaming
- **WHEN** a new message is being streamed and the user is scrolled near the bottom (within 50px)
- **THEN** the container auto-scrolls to keep the latest content visible

#### Scenario: Manual scroll-up preserved
- **WHEN** the user scrolls up to read earlier messages during streaming
- **THEN** the container does NOT auto-scroll until the user scrolls back near the bottom

### Requirement: Inline question rendering
When the agent asks a question with options, the question SHALL render as interactive radio/checkbox elements inside an agent message bubble in the chat stream.

#### Scenario: Question with options displayed
- **WHEN** the agent sends a question event with options
- **THEN** the question text and selectable options (radio for single, checkbox for multi) are rendered inside the current agent message bubble

#### Scenario: User answers via inline options
- **WHEN** the user selects options and clicks "Bestätigen"
- **THEN** the options are replaced, the selection is appended as a user message element, and the agent stream resumes

#### Scenario: Question without options (prompt)
- **WHEN** the agent asks a question without predefined options
- **THEN** a clickable prompt is rendered in the agent message bubble; clicking it opens a prompt() dialog for free-text input

### Requirement: Inline tool suspension rendering
When the agent requires tool approval, the suspension SHALL render as approve/decline buttons inside an agent message bubble.

#### Scenario: Tool approval displayed
- **WHEN** the agent sends a suspension event for a tool call
- **THEN** warning text and approve/decline buttons are rendered inside the current agent message bubble

#### Scenario: User approves tool
- **WHEN** the user clicks "Bestätigen" / "Zulassen"
- **THEN** an approval user message is appended and the agent stream resumes

#### Scenario: User declines tool
- **WHEN** the user clicks "Ablehnen"
- **THEN** a decline user message is appended and the agent stream resumes

### Requirement: Transient status messages
Brief status lines ("Sende: ...", "Navigiere zu ...", error messages) SHALL be rendered as message elements in the chat stream.

#### Scenario: Navigation status
- **WHEN** the agent triggers a navigation event
- **THEN** a brief "Navigiere zu ..." message element is appended to the chat history

#### Scenario: Error display
- **WHEN** the agent returns an error event
- **THEN** an error-styled message element is appended to the chat history
