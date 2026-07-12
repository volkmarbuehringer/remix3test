## ADDED Requirements

### Requirement: Forward all Mastra stream chunk types as SSE events

The test agent controller SHALL forward every native Mastra stream chunk type from the agent's `fullStream` to the client as an SSE event. The SSE event name MUST be identical to the chunk type. The SSE event data MUST contain a structured subset of the chunk payload suitable for display. The controller MUST continue to forward `text-delta` as `message`, `tool-call-approval` as `suspension`, and `tool-call-suspended` with a question payload as `question` for backward compatibility.

#### Scenario: Tool call arguments stream in real time
- **WHEN** the agent generates a tool call
- **THEN** the controller emits `tool-call-input-streaming-start`, one or more `tool-call-delta`, and `tool-call-input-streaming-end` SSE events before the `tool-call` event

#### Scenario: Tool result is forwarded
- **WHEN** a tool completes execution
- **THEN** the controller emits a `tool-result` SSE event with the tool name and result data

#### Scenario: Finish payload excludes messages
- **WHEN** the stream emits a `finish` chunk
- **THEN** the controller emits a `complete` SSE event (existing behavior) and SHALL NOT include the `messages` or `response` fields

### Requirement: Render tool lifecycle cards in the test agent UI

The test agent client SHALL render structured cards for each tool call in chronological order within a timeline container. Each tool card SHALL display the tool name, the complete arguments, the result summary, and step token usage when available. Tool cards SHALL be collapsible.

#### Scenario: Tool card shows when tool call begins
- **WHEN** the client receives a `tool-call-input-streaming-start` SSE event
- **THEN** the client creates a new tool card element in the timeline with the tool name displayed

#### Scenario: Arguments display updates incrementally
- **WHEN** the client receives `tool-call-delta` SSE events
- **THEN** the client appends the `argsTextDelta` to an accumulator and displays the growing partial JSON

#### Scenario: Arguments finalize on complete input
- **WHEN** the client receives a `tool-call` SSE event
- **THEN** the client replaces the partial JSON display with a formatted view of the complete arguments object

#### Scenario: Result shown on tool completion
- **WHEN** the client receives a `tool-result` SSE event
- **THEN** the client appends a result summary to the tool card showing file count, sizes (for listTestFiles) or a generic result preview

#### Scenario: Tool card is collapsible
- **WHEN** the user clicks the tool card header
- **THEN** the card body toggles between expanded and collapsed states

### Requirement: Show step token usage

The test agent client SHALL display token usage (prompt, completion, total) per processing step.

#### Scenario: Token usage shown after step completes
- **WHEN** the client receives a `step-finish` or `finish` SSE event with usage data
- **THEN** the client appends a token usage badge to the most recent tool card or message

### Requirement: Show reasoning text when available

The test agent client SHALL accumulate reasoning text from `reasoning-delta` chunks and display it in an expandable element.

#### Scenario: Reasoning displayed as expandable block
- **WHEN** the client receives `reasoning-start`, `reasoning-delta`, and `reasoning-end` SSE events
- **THEN** the client accumulates the reasoning text and renders it in a `<details>` element between the step marker and the tool card or message

#### Scenario: No reasoning chunks produce no reasoning UI
- **WHEN** the model does not emit reasoning chunks
- **THEN** the client renders no reasoning element (no broken or empty UI)

### Requirement: Handle large tool results gracefully

The controller SHALL truncate tool result arrays exceeding 20 entries, adding a `_truncated: true` flag and `_truncatedCount` field.

#### Scenario: Large result list is truncated
- **WHEN** a tool result contains more than 20 items in an array
- **THEN** the controller truncates to 20 items and includes `_truncated: true` and `_truncatedCount` in the forwarded payload

### Requirement: Tool errors are visible

The test agent client SHALL display tool errors when a tool throws during execution.

#### Scenario: Tool error shows in the timeline
- **WHEN** the client receives a `tool-error` SSE event
- **THEN** the client renders an error state on the corresponding tool card with the error message
