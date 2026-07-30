## Purpose

Browser tests for the 6 SSE-based agent stream components (CustomerChatStream, TestAgentStream, SupportAgentStream, WorkflowAgentStream, RouteAgentStream, AgentEventsStream). These share a common EventSource lifecycle pattern and have zero test coverage.

## ADDED Requirements

### Requirement: SSE connection lifecycle
The system SHALL establish and maintain an SSE EventSource connection to the backend agent endpoint.

#### Scenario: Component mounts and opens EventSource
- **WHEN** the clientEntry component mounts
- **THEN** an EventSource is opened to the agent's SSE URL with the correct CSRF token and parameters

#### Scenario: Component unmounts and closes EventSource
- **WHEN** the clientEntry component unmounts (handle.signal aborts)
- **THEN** the EventSource is closed and no further events are processed

#### Scenario: AbortController cleanup on lifecycle signal
- **WHEN** handle.signal fires abort
- **THEN** current EventSource is closed, AbortController is aborted

### Requirement: Streaming message display
The system SHALL render agent messages incrementally as SSE events arrive.

#### Scenario: Streaming text appends to assistant bubble
- **WHEN** an SSE "data" event with a text chunk arrives
- **THEN** the text is appended to the current streaming assistant bubble in the chat area

#### Scenario: User messages are rendered as right-aligned blue bubbles
- **WHEN** user submits a message via the input form
- **THEN** the message appears as a right-aligned bubble with blue background and white text

#### Scenario: Assistant messages are rendered as left-aligned bubbles
- **WHEN** the first assistant text chunk arrives after a user message
- **THEN** a new left-aligned bubble is created for the assistant response

#### Scenario: Scroll-to-bottom on new content
- **WHEN** new message content is appended to the chat area
- **THEN** the chat area scrolls to the bottom (scrollTop = scrollHeight)

### Requirement: Tool card rendering
The system SHALL render expandable tool call cards for intermediate agent tool invocations.

#### Scenario: Tool card is created on tool_start event
- **WHEN** an SSE event with type "tool_start" arrives containing a tool name and tool_call_id
- **THEN** a collapsible card is rendered in the chat area with the tool name as header

#### Scenario: Tool arguments accumulate in card body
- **WHEN** SSE events with type "tool_args" arrive with tool_call_id and incremental JSON text
- **THEN** the text is accumulated into the corresponding tool card's body content

#### Scenario: Tool result renders in card footer
- **WHEN** an SSE event with type "tool_result" arrives with tool_call_id and result text
- **THEN** the result is displayed in the card footer below the header

#### Scenario: Duplicate tool_call_id does not create duplicate cards
- **WHEN** a tool_start event with an existing tool_call_id arrives
- **THEN** no duplicate card is created; the existing card is reused

### Requirement: Abort and retry
The system SHALL allow aborting an in-progress stream and retrying.

#### Scenario: Abort button closes EventSource
- **WHEN** user clicks the abort button during streaming
- **THEN** the current EventSource is closed, streaming state is reset

#### Scenario: Retry after abort sends new request
- **WHEN** user clicks retry after an aborted stream
- **THEN** a new EventSource is opened and a new run_id is assigned

### Requirement: Workflow agent step progress
The system SHALL render workflow step progress (completed/running/error/suspended states) from SSE events.

#### Scenario: Step transitions to completed on step_complete event
- **WHEN** an SSE event with type "step_complete" arrives with step_id and result
- **THEN** the step's visual indicator transitions to the completed state (checkmark)

#### Scenario: Step transitions to error on step_error event
- **WHEN** an SSE event with type "step_error" arrives with step_id and error message
- **THEN** the step's visual indicator transitions to the error state (exclamation)

#### Scenario: Final result summary renders
- **WHEN** the workflow SSE stream completes
- **THEN** a final result summary section is rendered below the step list

### Requirement: Route agent question prompts and navigation
The system SHALL render question prompts and support navigation prefill from the route agent stream.

#### Scenario: Question prompt renders with selectable options
- **WHEN** an SSE event with a question prompt arrives
- **THEN** the prompt with selectable options is rendered in the chat area

#### Scenario: Selection triggers navigation with prefill
- **WHEN** user selects a question option
- **THEN** the system navigates to the target route with prefill data

### Requirement: Connection status indicator
The system SHALL visually indicate SSE connection state via the ConnectionIndicator component.

#### Scenario: Connected state shows green dot
- **WHEN** the EventSource opens successfully
- **THEN** the connection indicator shows a green dot

#### Scenario: Disconnected state shows red dot
- **WHEN** the EventSource closes or errors
- **THEN** the connection indicator shows a red dot

#### Scenario: Invalidate event reloads the frame
- **WHEN** an SSE event with type "invalidate" arrives
- **THEN** frame.reload() or window.location.reload() is called, unless skipReloadParams match
