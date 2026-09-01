# customer-chat Specification

## Purpose

Defines the public customer-facing agent chat (`/chat`): a single-connection streaming transport that no longer buffers agent output in process memory, conversation history rehydrated from agent memory on load so a customer resumes their most recent conversation, and durable run ownership so approval/resume flows survive a server restart or scale-out.

## Requirements

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

### Requirement: Conversation history is resumed on load

The `index` route SHALL rehydrate the authenticated user's most recent conversation from agent memory on page load instead of always rendering an empty conversation area. The most recent thread for the user SHALL be resolved and its prior turns SHALL be server-rendered so the customer sees their past conversation after a refresh, tab return, or navigation. When the user has no prior conversation (or explicitly starts a new one), the page SHALL render an empty conversation area. Turns SHALL continue to be persisted to agent memory as the conversation advances.

#### Scenario: Returning customer sees their conversation

- **WHEN** an authenticated customer loads `/chat` and has a prior conversation stored for their resource
- **THEN** the page SHALL render the prior turns as server-rendered conversation bubbles
- **AND** the page SHALL expose the resumed thread id to the streaming client so subsequent messages continue the same thread

#### Scenario: Fresh user sees an empty conversation

- **WHEN** an authenticated customer loads `/chat` and has no prior stored conversation
- **THEN** the page SHALL render an empty conversation area with no server-rendered message history

#### Scenario: Turns are still persisted to memory

- **WHEN** the agent produces a reply during a streamed turn
- **THEN** the turn SHALL be written to the user's conversation memory under the active thread and resource

### Requirement: New conversation control

The customer chat SHALL expose a control to start a new conversation, which clears the active thread and renders an empty conversation area. The next submitted message after activating the control SHALL begin a fresh thread rather than extending the previous one.

#### Scenario: Starting a new conversation clears history

- **WHEN** a customer with an active conversation activates the new-conversation control
- **THEN** the active thread SHALL be cleared and the conversation area SHALL be rendered empty
- **AND** subsequent messages SHALL be written to a new thread

### Requirement: Customer chat UI conforms to theme tokens

The customer chat interface SHALL source all visual styling from theme tokens rather than hardcoded colors, so the interface adapts to the active theme (including dark mode) without per-component overrides.

#### Scenario: Bubbles and cards use theme tokens

- **WHEN** the chat renders user bubbles, assistant bubbles, tool cards, approval cards, question cards, and the slot picker
- **THEN** the background, foreground, border, and surface colors SHALL derive from theme tokens

#### Scenario: No hardcoded color literals remain

- **WHEN** the customer chat rendering is inspected
- **THEN** there SHALL be no hardcoded hex color literals in the chat rendering

### Requirement: Customer chat is screen-reader and keyboard accessible

The customer chat interface SHALL announce new turns to assistive technology and SHALL be operable by keyboard, including focus management across submit, answer, approval, and slot-selection flows, and a visible busy state while the agent is streaming.

#### Scenario: New turns are announced

- **WHEN** a new message is appended to the conversation
- **THEN** the conversation container SHALL expose a live region that announces the new turn to assistive technology

#### Scenario: Focus is managed and busy state is shown

- **WHEN** the customer submits a message, answers a question, approves/declines a tool decision, or picks a slot
- **THEN** focus SHALL move to a predictable element (the new message, the composer, or the activated control)
- **AND** a visible busy or thinking state SHALL be shown while the agent is streaming

#### Scenario: Interactive controls are keyboard operable

- **WHEN** the customer navigates the tool approval, question, or slot-picker controls
- **THEN** all controls SHALL be reachable and operable via keyboard

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
