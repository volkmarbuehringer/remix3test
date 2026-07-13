## ADDED Requirements

### Requirement: Single-request agent stream

The route agent POST /route-agent action SHALL pipe the Mastra agent's fullStream directly into the HTTP response body instead of storing it and returning a runId for a separate SSE connection.

#### Scenario: Action streams agent output in POST response

- **WHEN** client POSTs to /route-agent with a `message` field
- **THEN** the response SHALL have Content-Type `text/event-stream` and SHALL contain SSE events written as the agent produces them
- **THEN** the response SHALL NOT require a second connection to consume the stream
- **THEN** the response SHALL end when the agent finishes (complete event) or suspends (question/suspension event)

### Requirement: No stream-store dependency

The route agent action SHALL NOT use stream-store.ts or any intermediary storage to hold agent output between requests.

#### Scenario: stream-store.ts is removed

- **WHEN** the route action handles an agent interaction
- **THEN** the agent's output SHALL be consumed entirely within the action handler's request lifecycle
- **THEN** the stream-store.ts file SHALL be deleted
- **THEN** the /stream/:runId route SHALL be removed

### Requirement: Navigation event type

The route agent SHALL emit a typed `navigate` SSE event when the agent decides to navigate, instead of relying on client-side inspection of generic tool-result events.

#### Scenario: navigate event triggers frame navigation

- **WHEN** the agent's routeNavigate tool produces a result
- **THEN** the SSE stream SHALL emit a `navigate` event with `href`, `target`, and `history` fields
- **WHEN** the clientEntry receives a `navigate` event
- **THEN** it SHALL set the target frame's src, reload the frame, and update window.history

### Requirement: Filtered SSE event types

The route agent controller SHALL only forward SSE event types that the clientEntry consumes.

#### Scenario: Unused event types are omitted

- **WHEN** the Mastra agent produces events like step-start, step-finish, reasoning-*, text-*, tool-call-*
- **THEN** the route agent controller SHALL NOT forward these to the client unless the clientEntry explicitly handles them

### Requirement: Unified tool decision endpoint

The route agent SHALL expose a single POST /tool-decision endpoint instead of separate /approve and /decline endpoints.

#### Scenario: approve and decline use same endpoint

- **WHEN** the client sends POST /tool-decision with `decision: 'approve'`
- **THEN** the handler SHALL call agent.approveToolCallGenerate
- **WHEN** the client sends POST /tool-decision with `decision: 'decline'`
- **THEN** the handler SHALL call agent.declineToolCallGenerate
- **WHEN** the handler produces a stream result
- **THEN** the response SHALL stream agent output directly (same as the main action)
