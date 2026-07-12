## ADDED Requirements

### Requirement: Customer agent SHALL stream responses via SSE

The customer chat controller SHALL use `agent.stream()` instead of `agent.generate()`. The stream output SHALL be stored in the shared in-memory stream store and served via a dedicated SSE endpoint.

#### Scenario: Action starts a stream
- **WHEN** the user submits a message via the chat form
- **THEN** the controller SHALL call `agent.stream()` with the message, threadId, and memory config
- **AND** the returned stream SHALL be stored via `setStream(runId, stream)`
- **AND** the action SHALL return JSON `{ runId, threadId }`
- **AND** the controller SHALL NOT call `agent.generate()` for any new message

#### Scenario: SSE endpoint serves stream events
- **WHEN** the client opens an EventSource to `/chat/stream/:runId`
- **THEN** the endpoint SHALL read from the stored stream's `fullStream`
- **AND** SHALL forward Mastra stream event types as SSE events (text-delta, tool-call, tool-result, tool-call-approval, finish, error, etc.)
- **AND** SHALL set proper SSE headers (text/event-stream, no-cache, keep-alive, X-Accel-Buffering: no)
- **AND** SHALL close the stream and clean up on client disconnect or stream end

#### Scenario: ClientEntry consumes SSE events
- **WHEN** the client receives a `text-delta` SSE event
- **THEN** the client SHALL append the text to the current assistant message bubble
- **WHEN** the client receives a `tool-call` event with tool args
- **THEN** the client SHALL render a collapsible tool call card showing the tool name and arguments
- **WHEN** the client receives a `tool-result` event
- **THEN** the client SHALL render the tool result below the corresponding tool call card
- **WHEN** the client receives a `tool-call-approval` event
- **THEN** the client SHALL render an approval card with Approve/Decline buttons
- **WHEN** the client receives a `complete` event
- **THEN** the client SHALL close the EventSource and re-enable the input form

### Requirement: No session-based transient state for agent data

All transient state from agent interactions SHALL flow through the SSE stream, not the HTTP session.

#### Scenario: Session flash for toolApproval is removed
- **WHEN** the agent suspends for tool approval
- **THEN** the controller SHALL NOT write to `session.flash('toolApproval', ...)`
- **AND** the approval data SHALL be sent via SSE `tool-call-approval` event instead

#### Scenario: Session pendingBooking is removed
- **WHEN** the agent finds available slots
- **THEN** the controller SHALL NOT write `session.set('pendingBooking', ...)`
- **AND** the slot data SHALL arrive as a `tool-result` SSE event
- **AND** the client SHALL render clickable slot buttons directly from the stream event

#### Scenario: Session bookingResult is removed
- **WHEN** a booking is completed or fails
- **THEN** the controller SHALL NOT write `session.set('bookingResult', ...)`
- **AND** the booking result SHALL be displayed via the assistant's response text in the stream

#### Scenario: Session postBookingDecision is removed
- **WHEN** a booking succeeds
- **THEN** the controller SHALL NOT write `session.flash('postBookingDecision', ...)`
- **AND** the agent SHALL ask the user via `askUserTool` whether they want another booking

### Requirement: Controller SHALL support approve, decline, and answer actions

The chat controller SHALL expose endpoints for approving tool calls, declining tool calls, and answering agent questions, all returning JSON with a new `runId` for stream reconnection.

#### Scenario: Approve resumes the agent
- **WHEN** the user clicks Approve on a tool approval card
- **THEN** the client SHALL POST to `/chat/approve` with runId and toolCallId
- **AND** the controller SHALL call `agent.approveToolCallGenerate({ runId, toolCallId })`
- **AND** if the agent suspends again, the controller SHALL return `{ requiresApproval: true, ... }`
- **AND** if the agent completes the step, the controller SHALL return `{ runId }`
- **AND** the client SHALL open a new EventSource to the returned runId

#### Scenario: Decline rejects the tool call
- **WHEN** the user clicks Decline on a tool approval card
- **THEN** the client SHALL POST to `/chat/decline` with runId and toolCallId
- **AND** the controller SHALL call `agent.declineToolCallGenerate({ runId, toolCallId })`
- **AND** the response SHALL follow the same pattern as approve

#### Scenario: Answer resumes after askUserTool
- **WHEN** the user submits an answer to an askUserTool question
- **THEN** the client SHALL POST to `/chat/answer` with runId, answer, toolCallId, and selectionMode
- **AND** the controller SHALL call `agent.resumeStream(resumeData, { runId, toolCallId })`
- **AND** if the answer is a multi-select, the client SHALL JSON-serialize the selected values
- **AND** the response SHALL return `{ runId }` for reconnection

### Requirement: Client SHALL handle question cards from askUserTool

The CustomerChatStream clientEntry SHALL render structured question cards when the agent uses `askUserTool`.

#### Scenario: Question card with radio options
- **WHEN** the client receives a `question` SSE event with options and `selectionMode: 'single_select'`
- **THEN** the client SHALL render a question card with the question text and radio buttons for each option
- **AND** SHALL show an Answer button
- **WHEN** the user clicks Answer with a selected option
- **THEN** the client SHALL POST the selected value as the answer

#### Scenario: Question card with free-text input
- **WHEN** the client receives a `question` SSE event with no options
- **THEN** the client SHALL render a question card with a text input field
- **AND** pressing Enter in the input SHALL submit the answer

### Requirement: Agent SHALL own the booking flow end-to-end

The separate `confirm_booking` form action SHALL be removed. The agent SHALL use `trigger_booking_workflow` tool for all bookings.

#### Scenario: User books a slot via chat
- **WHEN** the user clicks a slot button or says "Ich möchte Slot X buchen"
- **THEN** the agent SHALL call `trigger_booking_workflow` with resourceId, date, startMin, title
- **AND** the booking result SHALL stream back as a tool-result and assistant response
- **AND** no separate form POST to `confirm_booking` SHALL occur

#### Scenario: No redirect for booking
- **WHEN** a booking succeeds or fails
- **THEN** the controller SHALL NOT redirect to the chat index
- **AND** the result SHALL be delivered via the SSE stream

### Requirement: Multi-resource conversational loop

When a resource has no available slots, the agent SHALL offer the customer alternative resources instead of ending the conversation.

#### Scenario: No slots found for selected resource
- **WHEN** `find_next_available_slots` returns empty slots
- **THEN** the agent SHALL use `askUserTool` to ask "Leider keine freien Termine. Möchten Sie eine andere Ressource probieren?"
- **AND** SHALL present the remaining search results as radio options
- **AND** if the user picks one, the agent SHALL call `find_next_available_slots` for the new resource

#### Scenario: Multiple bookings in one session
- **WHEN** a booking succeeds
- **THEN** the agent SHALL use `askUserTool` to ask "Möchten Sie einen weiteren Termin buchen?"
- **AND** if yes, the agent SHALL ask for new requirements and restart the search loop
- **AND** if no, the agent SHALL end the conversation naturally
