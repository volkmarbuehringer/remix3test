## ADDED Requirements

### Requirement: Agent reuses previous search context after "yes"

When the customer agent asks "Möchten Sie einen weiteren Termin buchen?" and the user responds "Ja, weitermachen", the agent SHALL reuse the same search terms from the previous `searchResourcesByCapability` call in the current conversation to automatically search for resources and present options via `askUserTool`.

#### Scenario: User says "yes" with previous search context available

- **WHEN** the user selects "Ja, weitermachen" after a successful booking
- **THEN** the agent calls `searchResourcesByCapability` with the same query as the first booking
- **AND** the agent presents found resources via `askUserTool` for selection
- **AND** the user does NOT need to type free text to describe their need again

#### Scenario: User says "yes" but no previous search context exists

- **WHEN** the user selects "Ja, weitermachen" after a successful booking
- **AND** no prior `searchResourcesByCapability` call was made in this conversation
- **THEN** the agent SHALL ask the user what they are looking for via `askUserTool` with an appropriate question

### Requirement: Stream resumption produces usable SSE data

When `agent.resumeStream()` returns a `MastraModelOutput` after the user answers a `askUserTool` question, the controller SHALL store the stream under a fresh `runId` (not the original suspended stream's runId) so that the client's `EventSource` receives the full agent response.

#### Scenario: Answer produces a new stream

- **WHEN** the user answers a question via `POST /chat/answer`
- **THEN** the response SHALL contain a `runId` that is different from the original suspended stream's runId
- **AND** the client SHALL open an `EventSource` to `/chat/stream/{newRunId}`
- **AND** the SSE stream SHALL contain all events from the agent's response (text deltas, tool calls, results, etc.)

### Requirement: Client sends toolCallId with answer

When the client sends an answer to `POST /chat/answer`, it SHALL include the `toolCallId` from the pending question state, so that `agent.resumeStream()` correctly targets the suspended `askUserTool` call.

#### Scenario: Answer includes toolCallId

- **WHEN** the user clicks "Antworten" on a question card rendered by `askUserTool`
- **THEN** the `POST /chat/answer` request SHALL include the `toolCallId` of the suspended tool call
- **AND** the server SHALL pass this `toolCallId` to `agent.resumeStream()`
