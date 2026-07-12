## ADDED Requirements

### Requirement: Agent can present structured questions mid-turn

The test agent SHALL be able to suspend its current execution turn and present a structured question to the user. The question SHALL support three modes: free-text (no options), single-select (one choice from a list), and multi-select (multiple choices from a list). The agent SHALL resume execution with the user's answer as the tool result.

#### Scenario: Agent presents single-select question
- **WHEN** the agent calls `askUserTool` with a `question` and `options` array (no `selectionMode`)
- **THEN** the SSE stream SHALL emit a `tool-call-suspended` chunk with `suspendPayload.question`, `suspendPayload.options`, and `suspendPayload.selectionMode` omitted or `"single_select"`
- **AND** the UI SHALL render the question with radio-button options
- **WHEN** the user selects an option and submits
- **THEN** the system SHALL call `agent.resumeStream(selectedLabel, { runId })`
- **AND** the agent SHALL continue execution with the selected label as the tool result

#### Scenario: Agent presents free-text question
- **WHEN** the agent calls `askUserTool` with a `question` and no `options`
- **THEN** the SSE stream SHALL emit a `tool-call-suspended` chunk with `suspendPayload.question` and no `options`
- **AND** the UI SHALL render the question with a text input
- **WHEN** the user types an answer and submits
- **THEN** the system SHALL call `agent.resumeStream(userText, { runId })`
- **AND** the agent SHALL continue execution with the user's text as the tool result

#### Scenario: Agent presents multi-select question
- **WHEN** the agent calls `askUserTool` with `question`, `options`, and `selectionMode: "multi_select"`
- **THEN** the SSE stream SHALL emit a `tool-call-suspended` chunk with `suspendPayload.selectionMode` set to `"multi_select"`
- **AND** the UI SHALL render the question with checkbox options
- **WHEN** the user selects multiple options and submits
- **THEN** the system SHALL call `agent.resumeStream(["option1", "option2"], { runId })`
- **AND** the agent SHALL continue execution with the array of selected labels as the tool result

### Requirement: SSE stream SHALL emit `question` event for tool-call-suspended chunks

The test agent's SSE handler SHALL detect `tool-call-suspended` chunks and emit an SSE `event: question` with the suspend payload data serialized as JSON.

#### Scenario: SSE handler emits question event
- **WHEN** the test agent stream emits a chunk with `type: "tool-call-suspended"`
- **THEN** the SSE handler SHALL emit `event: question\ndata: { runId, toolCallId, question, options?, selectionMode? }`
- **AND** SHALL NOT emit a `event: suspension` (which is reserved for `tool-call-approval`)

### Requirement: Answer endpoint resumes agent execution

The controller SHALL provide an `answer` action that receives the user's answer and resumes the suspended agent run via `agent.resumeStream(answer, { runId })`. The resumed stream SHALL be stored in the stream-store following the same pattern as the initial `action` and `approve` endpoints.

#### Scenario: User answers a question
- **WHEN** the user submits an answer
- **THEN** the `answer` action SHALL call `agent.resumeStream(answer, { runId })`
- **AND** the returned stream SHALL be stored via `setStream`
- **AND** the response SHALL return `{ runId, threadId }` for the client to connect to SSE

#### Scenario: Answer with missing runId
- **WHEN** the answer action is called without a `runId`
- **THEN** the system SHALL return `{ error: "Missing runId" }` with status 400

### Requirement: Agent instructions describe when to use askUserTool

The test agent's instructions SHALL describe scenarios where `askUserTool` is appropriate: when the user's request is ambiguous and multiple valid paths exist, or when the agent needs to choose between options before proceeding with a tool call.

#### Scenario: Agent uses askUserTool for sort criteria
- **WHEN** the user says "sort the files in output/" without specifying a sort field
- **THEN** the agent SHALL call `listTestFiles` to discover files, then call `askUserTool` with `question: "Sort by what criteria?"` and `options: [{ label: "size" }, { label: "mtime" }, { label: "name" }]`
- **AND** SHALL NOT proceed to sort without knowing the user's preference

#### Scenario: Agent continues in same turn after answer
- **WHEN** the user selects "size" from the sort options
- **THEN** the agent SHALL call `listTestFiles` with `sort: "size"` in the same execution turn
- **AND** SHALL display the result without requiring a new user message
