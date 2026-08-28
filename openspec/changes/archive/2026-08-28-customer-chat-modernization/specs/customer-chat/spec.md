## Purpose

Defines the public customer-facing agent chat (`/chat`): a single-connection streaming transport that no longer buffers agent output in process memory, history that is session/DOM-scoped rather than server-replayed on load, and durable run ownership so approval/resume flows survive a server restart or scale-out.

## ADDED Requirements

### Requirement: Chat messages stream over the original POST connection

The system SHALL return the agent's output as a `text/event-stream` response body on the same HTTP request that submits the message (POST `/chat`), rather than returning a handle for a client to fetch a second buffered stream.

#### Scenario: Agent reply arrives on the submitting request only

- **WHEN** a user submits a chat message via POST `/chat`
- **THEN** the response SHALL be a streaming `text/event-stream` that emits the agent's `message` deltas and a terminal `complete` event on that same request
- **AND** the client SHALL NOT need to open a second request to read the reply

#### Scenario: Stream errors surface as SSE events

- **WHEN** the agent errors while streaming a reply
- **THEN** the response SHALL emit an `agent-error` SSE event and then close, rather than returning a non-streamed error payload

### Requirement: Output is not held in process memory

The system SHALL NOT stage agent stream output in an in-process, instance-local store before it is delivered. A client disconnect, server restart, or scale-out SHALL NOT leave a reattachable buffered copy of the stream.

#### Scenario: No separate re-attach endpoint

- **WHEN** a client submits a message
- **THEN** the system SHALL NOT expose or require a `/chat/stream/:runId` endpoint to replay the stream

#### Scenario: No per-run in-memory buffer

- **WHEN** a run is created
- **THEN** the run's stream SHALL be delivered directly to the requesting client, not stored in process memory for later retrieval

### Requirement: Conversation history is session-scoped on load

The `index` route SHALL render an empty conversation area rather than rehydrating previous turns from agent memory into the page. Earlier turns SHALL still be persisted to agent memory as the conversation advances, but SHALL NOT be server-rendered on a fresh page load.

#### Scenario: Fresh page load is empty

- **WHEN** a user loads `/chat` with no active client-side thread
- **THEN** the page SHALL render an empty conversation area with no server-rendered message history

#### Scenario: Turns are still persisted to memory

- **WHEN** the agent produces a reply during a streamed turn
- **THEN** the turn SHALL be written to the user's conversation memory under the active thread and resource

### Requirement: Run ownership survives restart and scale-out

The system SHALL verify that a user owns a run before allowing approval (`approve`), rejection (`decline`), or a suspension answer (`answer`). This ownership check SHALL derive from durable storage rather than an in-process store, so it is correct after a server restart or across scaled instances.

#### Scenario: Owner can resume a suspended run

- **WHEN** an authenticated user that initiated a suspended run submits `approve`, `decline`, or `answer` for that run
- **THEN** the system SHALL allow the operation and resume the agent

#### Scenario: Non-owner is rejected

- **WHEN** a different authenticated user attempts `approve`, `decline`, or `answer` for a run they did not initiate
- **THEN** the system SHALL reject the operation (forbidden)

#### Scenario: Ownership survives restart

- **WHEN** a run is suspended and the server restarts before the user resolves it
- **THEN** the owning user SHALL still be able to `approve`/`decline`/`answer` the run

### Requirement: Customer agent capabilities and interface are preserved

The system SHALL retain the customer agent's tool capabilities (slot search, capability search, booking) and the interactive tool/slot UI, and SHALL keep the chat as a self-contained interface (the agent does not navigate the user to other application routes).

#### Scenario: Interactive slot picker still appears

- **WHEN** a tool result provides available appointment slots
- **THEN** the client SHALL render the slot picker and let the user pick a slot to book

#### Scenario: No agent-driven application navigation

- **WHEN** the agent produces output
- **THEN** the system SHALL NOT navigate the user to a different route from the chat

### Requirement: Per-user rate limiting is enforced

The system SHALL enforce the per-user rate limit on chat message submission and on approval/resume operations, rejecting bursts with an error as before.

#### Scenario: Burst is rate limited

- **WHEN** a user submits messages more frequently than the configured per-user limit
- **THEN** the system SHALL reject the excess attempt with a rate-limit error
