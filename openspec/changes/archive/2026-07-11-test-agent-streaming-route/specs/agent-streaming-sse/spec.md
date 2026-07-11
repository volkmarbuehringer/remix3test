## ADDED Requirements

### Requirement: SSE endpoint pipes Mastra stream chunks
The system SHALL expose a GET `/testagent/stream/:runId` endpoint that returns a `text/event-stream` response. The endpoint SHALL read the corresponding `MastraModelOutput` from an in-memory stream store and pipe chunks as SSE events. When the stream completes, the endpoint SHALL send a `complete` event and close the connection.

#### Scenario: Successful stream delivery
- **WHEN** a `MastraModelOutput` is stored under `runId` and a client connects to GET `/testagent/stream/:runId`
- **THEN** the endpoint SHALL send SSE `message` events containing text tokens as they arrive
- **THEN** when the stream finishes, the endpoint SHALL send a `complete` event and close the connection

#### Scenario: Run ID not found
- **WHEN** a client connects to GET `/testagent/stream/:nonexistent`
- **THEN** the endpoint SHALL return HTTP 404

### Requirement: POST action starts stream and returns runId
The POST `/testagent` action SHALL validate the message, call `agent.stream()`, store the returned `MastraModelOutput` in the stream store keyed by `runId`, and return `{ runId, threadId }` as JSON.

#### Scenario: Valid message
- **WHEN** a client POSTs `{ message: "list files" }` to `/testagent`
- **THEN** the action SHALL call `agent.stream()` with the message
- **THEN** the action SHALL store the output in the stream store
- **THEN** the action SHALL return HTTP 200 with JSON body `{ runId: string, threadId: string }`

#### Scenario: Empty message
- **WHEN** a client POSTs `{ message: "" }` to `/testagent`
- **THEN** the action SHALL return HTTP 400 with `{ error: string }`

### Requirement: Stream store is in-memory with TTL cleanup
The stream store SHALL be a singleton module exporting `get`, `set`, and `delete` functions backed by a `Map<string, MastraModelOutput>`. Each entry SHALL have a configurable TTL (default 5 minutes) after which it is automatically removed.

#### Scenario: Store and retrieve
- **WHEN** an output is stored with `streamStore.set(runId, output)`
- **THEN** `streamStore.get(runId)` SHALL return the output

#### Scenario: TTL cleanup
- **WHEN** an entry has been in the store longer than the TTL
- **THEN** `streamStore.get(runId)` SHALL return `undefined`
- **THEN** the entry SHALL be removed from the map

### Requirement: Stream suspension delivers tool-call details
When the agent run suspends for tool approval, the SSE endpoint SHALL send a `suspension` event with `{ toolCallId, toolName, args }`. The SSE connection SHALL then close so the client can reconnect after approval.

#### Scenario: Tool call suspends the stream
- **WHEN** a tool with `requireToolApproval` is invoked during `agent.stream()`
- **THEN** the SSE endpoint SHALL send an event `suspension` with `{ toolCallId, toolName, args }`
- **THEN** the SSE endpoint SHALL close the connection

### Requirement: Approval/rejection resumes via new SSE connection
The POST `/testagent/approve` and `/testagent/decline` actions SHALL accept `{ runId, toolCallId }`, call the corresponding agent method, store the new output in the stream store, and return the new `runId` as JSON.

#### Scenario: Approve tool call
- **WHEN** a client POSTs `{ runId, toolCallId }` to `/testagent/approve`
- **THEN** the action SHALL call `agent.approveToolCallGenerate()`
- **THEN** the action SHALL store the new output in the stream store
- **THEN** the action SHALL return HTTP 200 with `{ runId: string }`

#### Scenario: Decline tool call
- **WHEN** a client POSTs `{ runId, toolCallId }` to `/testagent/decline`
- **THEN** the action SHALL call `agent.declineToolCallGenerate()`
- **THEN** the action SHALL store the new output in the stream store
- **THEN** the action SHALL return HTTP 200 with `{ runId: string }`

### Requirement: SSE headers follow existing pattern
The SSE response SHALL set `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-store`, `Connection: keep-alive`, and `X-Accel-Buffering: no`, matching the pattern in `app/utils/sse.ts`.

#### Scenario: SSE response headers
- **WHEN** a client connects to GET `/testagent/stream/:runId`
- **THEN** the response SHALL have `Content-Type: text/event-stream`
- **THEN** the response SHALL have `Cache-Control: no-cache, no-store`
