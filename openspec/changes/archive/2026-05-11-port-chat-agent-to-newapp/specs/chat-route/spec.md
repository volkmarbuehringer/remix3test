## ADDED Requirements

### Requirement: Chat route serves index page

The system SHALL serve an HTML page at `/chat` that displays the chat interface with message history from a previous conversation if a valid `chatId` query parameter is provided.

#### Scenario: GET /chat without chatId

- **WHEN** a user navigates to `/chat` without a `chatId` parameter
- **THEN** the system SHALL render a chat page with an empty messages area and an empty state prompt "Start a conversation"

#### Scenario: GET /chat with valid chatId

- **WHEN** a user navigates to `/chat?chatId=<valid-id>`
- **THEN** the system SHALL load the conversation from the `chatlog` table and render all previous messages in the chat UI

#### Scenario: GET /chat with invalid chatId format

- **WHEN** a user navigates to `/chat?chatId=<invalid-format>`
- **THEN** the system SHALL treat the chatId as absent and render the empty state

#### Scenario: GET /chat with error parameter

- **WHEN** a user navigates to `/chat?error=<message>`
- **THEN** the system SHALL render the chat page with an error banner showing the error message

### Requirement: Chat route processes messages via POST

The system SHALL accept form submissions at `/chat` via POST, process the user message through an LLM, save both the user message and the assistant response to the conversation, and redirect back to the chat page with the updated `chatId`.

#### Scenario: POST with valid message and no existing conversation

- **WHEN** a user submits a message via POST to `/chat` with no `conversationId`
- **THEN** the system SHALL create a new conversation, call the LLM with the message, save both user and assistant messages, and redirect to `/chat?chatId=<new-id>`

#### Scenario: POST with valid message and existing conversation

- **WHEN** a user submits a message via POST to `/chat` with a valid `conversationId`
- **THEN** the system SHALL append the user message to the existing conversation, call the LLM with the full conversation history, save the assistant response, and redirect to `/chat?chatId=<existing-id>`

#### Scenario: POST with empty message

- **WHEN** a user submits an empty or whitespace-only message
- **THEN** the system SHALL return a 400 JSON response with error message "Please enter a message"

#### Scenario: POST with message exceeding 5000 characters

- **WHEN** a user submits a message longer than 5000 characters
- **THEN** the system SHALL return a 400 JSON response with a message length error

#### Scenario: POST rate limited

- **WHEN** a user submits a message within 2 seconds of a previous submission
- **THEN** the system SHALL return a 429 JSON response with a rate limit error message

#### Scenario: LLM call fails

- **WHEN** the LLM call throws an error or returns an empty response
- **THEN** the system SHALL redirect to `/chat?chatId=<id>&error=<error-message>` with an appropriate error message

### Requirement: Chat UI displays messages with metadata

The chat page SHALL render messages in reverse chronological order (newest first) with distinct styling for user vs. assistant messages, including avatars, timing badges, and token usage when available.

#### Scenario: Messages displayed with correct styling

- **WHEN** the chat page renders messages
- **THEN** user messages SHALL appear right-aligned with primary color background, and assistant messages SHALL appear left-aligned with surface-level-2 background

#### Scenario: Timing badge shown

- **WHEN** a message has an `elapsed` field
- **THEN** the system SHALL display an elapsed time badge next to the message label (e.g., "2.3s" or "450ms")

#### Scenario: Token badge shown

- **WHEN** a message has a `tokens` field
- **THEN** the system SHALL display a token count badge next to the message label
