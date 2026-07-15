## ADDED Requirements

### Requirement: Frame-based chat page layout
The support agent page SHALL use a `<Frame>` element for the chat history, with the agent bar and input bar rendered outside the frame on the page itself. This matches the route-agent page layout pattern.

#### Scenario: Chat history in frame
- **WHEN** an admin navigates to the support agent page
- **THEN** the chat history SHALL render inside a `<Frame name="support-content">`

#### Scenario: Agent bar below frame
- **WHEN** the page is rendered
- **THEN** an agent bar (`#agent-bar`) SHALL appear below the frame for streaming text, questions, and approvals

#### Scenario: Input bar at bottom
- **WHEN** the page is rendered
- **THEN** an input bar with a text input and submit button SHALL appear below the agent bar

#### Scenario: Frame reload on complete
- **WHEN** the SSE stream emits `event: complete`
- **THEN** the chat history frame SHALL reload to show the updated conversation

### Requirement: clientEntry streaming component
A `clientEntry()` component SHALL consume the SSE stream and update the agent bar in real time.

#### Scenario: Streaming text in agent bar
- **WHEN** `event: message` arrives with `{ text }`
- **THEN** the text SHALL be appended to the agent bar content

#### Scenario: Inline suspension UI
- **WHEN** `event: suspension` arrives with `{ toolCallId, toolName, args }`
- **THEN** the agent bar SHALL display approve/decline buttons for the tool call
- **AND** the client SHALL POST to `/toolDecision` with `decision=approve` or `decision=decline`

#### Scenario: Inline question UI
- **WHEN** `event: question` arrives with `{ runId, toolCallId, question, options, selectionMode }`
- **THEN** the agent bar SHALL display the question with radio/checkbox/input controls
- **AND** the client SHALL POST to `/answer` with the user's response

#### Scenario: Navigate event switches frame
- **WHEN** `event: navigate` arrives with `{ href, target }`
- **THEN** the frame named `target` SHALL update its `src` and reload

### Requirement: Initial chat history on GET
The GET request to `/mastra/chat` SHALL continue to render the initial chat history via `recallChatMessages()`, same as the current behavior.

#### Scenario: Existing chat loads on page load
- **WHEN** an admin opens the support agent page with a `threadId` query parameter
- **THEN** the frame SHALL render the full message history for that thread

### Requirement: Thread management preserved
The threadId SHALL be tracked across SSE interactions and available for subsequent messages, questions, and approvals.

#### Scenario: Thread ID maintained across stream
- **WHEN** a stream begins with `event: start { threadId }`
- **THEN** subsequent POSTs to `/toolDecision` and `/answer` SHALL include the threadId
