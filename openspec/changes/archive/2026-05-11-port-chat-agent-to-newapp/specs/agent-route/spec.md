## ADDED Requirements

### Requirement: Agent route serves index page

The system SHALL serve an HTML page at `/agent` that displays the agent interface with message history from a previous conversation if a valid `agentId` query parameter is provided.

#### Scenario: GET /agent without agentId

- **WHEN** a user navigates to `/agent` without an `agentId` parameter
- **THEN** the system SHALL render an agent page with an empty messages area and an empty state prompt "Start a conversation"

#### Scenario: GET /agent with valid agentId

- **WHEN** a user navigates to `/agent?agentId=<valid-id>`
- **THEN** the system SHALL load the conversation from the `chatlog` table and render all previous messages including tool call metadata

#### Scenario: GET /agent with invalid agentId format

- **WHEN** a user navigates to `/agent?agentId=<invalid-format>`
- **THEN** the system SHALL treat the agentId as absent and render the empty state

### Requirement: Agent route processes messages with tool calling

The system SHALL accept form submissions at `/agent` via POST, process the user message through a `ToolLoopAgent` with available tools (`get_weather`, `search_wikipedia`), save both the user message and the assistant response (including tool call metadata) to the conversation, and redirect back to the agent page.

#### Scenario: POST with valid message

- **WHEN** a user submits a message via POST to `/agent`
- **THEN** the system SHALL create or continue a conversation, run the `ToolLoopAgent` with conversation history, capture tool calls and results, save the conversation, and redirect to `/agent?agentId=<id>`

#### Scenario: POST with weather query

- **WHEN** a user asks about weather for a city
- **THEN** the agent SHALL invoke the `get_weather` tool with the city name, display the result (temperature, condition, humidity, wind speed), and include tool call metadata in the saved message

#### Scenario: POST with Wikipedia search query

- **WHEN** a user asks for information about a topic
- **THEN** the agent SHALL invoke the `search_wikipedia` tool, display search results with titles and URLs, and include tool call metadata in the saved message

#### Scenario: POST empty message returns 400

- **WHEN** a user submits an empty or whitespace-only message
- **THEN** the system SHALL return a 400 JSON response with error message "Please enter a message"

#### Scenario: POST with message exceeding 5000 characters

- **WHEN** a user submits a message longer than 5000 characters
- **THEN** the system SHALL return a 400 JSON response with a message length error

#### Scenario: Agent processing error

- **WHEN** the agent processing throws an error
- **THEN** the system SHALL redirect to `/agent?agentId=<id>` with a toast error message

### Requirement: Agent UI displays tool call metadata

The agent page SHALL render messages with tool call metadata inline, showing which tools were used, their inputs, and their results alongside the assistant's text response.

#### Scenario: Tool calls displayed in message

- **WHEN** an assistant message has tool calls
- **THEN** the system SHALL display a "Tools used" section showing each tool name, its input parameters, and its result below the message text

#### Scenario: Timing badge shown

- **WHEN** a message has an `elapsed` field
- **THEN** the system SHALL display an elapsed time badge (same format as chat route)

#### Scenario: Token badge shown

- **WHEN** a message has a `tokens` field
- **THEN** the system SHALL display a token count badge
