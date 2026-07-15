## ADDED Requirements

### Requirement: SSE streaming from POST endpoint
The support agent SHALL return a `text/event-stream` response from its POST action endpoint, piping the Mastra `agent.stream()` fullStream directly to the HTTP response.

#### Scenario: POST returns SSE response
- **WHEN** an admin sends a POST to `/mastra/chat` with a valid `message`
- **THEN** the response SHALL have `Content-Type: text/event-stream`

#### Scenario: First SSE event is start
- **WHEN** the SSE stream begins
- **THEN** the first event SHALL be `event: start` with `data: { runId, threadId }`

#### Scenario: Text deltas arrive as message events
- **WHEN** the agent generates text output
- **THEN** each text delta SHALL be sent as `event: message` with `data: { text }` before the stream ends

#### Scenario: Stream ends with complete event
- **WHEN** the agent finishes generating
- **THEN** the stream SHALL end with `event: complete` with `data: {}`

#### Scenario: Errors become agent-error events
- **WHEN** the agent encounters an error
- **THEN** the error SHALL be sent as `event: agent-error` with `data: { error }` and the stream SHALL close

### Requirement: Tool approval suspension via SSE
When a tool with `requireApproval: true` is reached during streaming, the agent SHALL suspend and emit a `suspension` event with the tool call details, allowing the client to approve or decline inline.

#### Scenario: Suspension event for requireApproval tool
- **WHEN** the agent encounters a tool with `requireApproval: true`
- **THEN** the stream SHALL emit `event: suspension` with `data: { toolCallId, toolName, args }` before closing

#### Scenario: Approve tool call resumes streaming
- **WHEN** the admin approves the tool via `/toolDecision`
- **THEN** a new SSE stream SHALL begin with the result of `agent.approveToolCallGenerate()`

#### Scenario: Decline tool call returns completion
- **WHEN** the admin declines the tool via `/toolDecision`
- **THEN** a new SSE stream SHALL begin with the result of `agent.declineToolCallGenerate()`

### Requirement: ask_user question via SSE
When the agent uses the `ask_user` tool, the stream SHALL emit a `question` event with the question text and options, then close.

#### Scenario: Question event for ask_user
- **WHEN** the agent calls the `ask_user` tool
- **THEN** the stream SHALL emit `event: question` with `data: { runId, toolCallId, question, options, selectionMode }` before closing

#### Scenario: Answer resumes streaming
- **WHEN** the admin answers via POST `/answer`
- **THEN** a new SSE stream SHALL begin with the result of `agent.resumeStream()`

### Requirement: Admin context injection during streaming
The `runWithAdminId()` async-storage wrapper SHALL be active during `agent.stream()` so that tools like `cancelUserAccount` can access `requireAdminId()`.

#### Scenario: Admin context available in tool execution
- **WHEN** a tool executes within a streamed agent call
- **THEN** `requireAdminId()` SHALL return the admin user ID set by `runWithAdminId()`

### Requirement: Rate limiting preserves per-user mode
The rate limiter SHALL remain per-user (keyed on `user.id`), not per-IP, matching the current support agent behavior.

#### Scenario: Per-user rate limit enforced
- **WHEN** a user exceeds the rate limit
- **THEN** the endpoint SHALL return HTTP 429 with an SSE `agent-error` event

### Requirement: Audit logging preserved
Every completed agent interaction SHALL create an audit log entry via `logAdminAction()`.

#### Scenario: Audit log on successful completion
- **WHEN** the agent stream completes successfully
- **THEN** an audit log entry with `action_type: 'support_message'` SHALL be recorded

### Requirement: AbortSignal timeout support
The `agent.stream()` call SHALL accept an `AbortSignal` to enforce a timeout, and the SSE stream SHALL close cleanly when aborted.

#### Scenario: Timeout closes stream with error
- **WHEN** the agent call exceeds the timeout
- **THEN** the SSE stream SHALL emit `event: agent-error` and close
