## ADDED Requirements

### Requirement: Controller returns JSON when agent header present

When the `verwaltung/resources` create controller receives a POST with the `X-Agent-Thread` header, it SHALL return a JSON response instead of an HTML redirect or HTML re-render.

#### Scenario: Successful resource creation returns JSON

- **WHEN** the controller receives a POST to `verwaltung/resources/create` with valid form data and `X-Agent-Thread` header set to a non-empty string
- **THEN** the controller SHALL create the resource in the database and return HTTP 200 with JSON body `{ status: "created", data: { id, name, description, capabilities }, threadId }`

#### Scenario: Validation error returns JSON

- **WHEN** the controller receives a POST with invalid form data and `X-Agent-Thread` header
- **THEN** the controller SHALL return HTTP 400 with JSON body `{ status: "validation_error", issues: [...], threadId }`

#### Scenario: No agent header preserves existing behavior

- **WHEN** the controller receives a POST without `X-Agent-Thread` header
- **THEN** the controller SHALL follow the existing HTML path (re-render with errors on validation failure, redirect on success)

### Requirement: Client intercepts JSON form responses

The `handleFrameFormSubmit` function in `route-agent-stream.tsx` SHALL inspect the response content-type after a frame form POST and forward JSON responses to the agent.

#### Scenario: JSON response forwarded to agent

- **WHEN** `handleFrameFormSubmit` receives a response with `content-type: application/json`
- **THEN** it SHALL POST to `/route-agent/answer` with `runId`, `answer` containing the parsed JSON, and `toolCallId` if available

#### Scenario: HTML response reloads frame

- **WHEN** `handleFrameFormSubmit` receives a response with `content-type: text/html`
- **THEN** it SHALL reload the frame as before (existing behavior unchanged)

### Requirement: Agent instructions for form workflows

The route-agent SHALL have instructions describing how to use form-driven workflows.

#### Scenario: Agent navigates and uses ask_user to wait

- **WHEN** the agent navigates to a form page
- **THEN** the agent SHALL call `ask_user` with a prompt asking the user to fill and submit the form
- **AND** the agent SHALL expect the answer to be a JSON string containing the form result (status, data)

#### Scenario: Successful creation reported to user

- **WHEN** the agent receives a form result with `status: "created"` and `data` containing `id`, `name`, and `description`
- **THEN** the agent SHALL report the successful creation to the user including the resource name and ID

#### Scenario: Validation error reported to user

- **WHEN** the agent receives a form result with `status: "validation_error"` and `issues` containing error details
- **THEN** the agent SHALL report the validation errors to the user and offer to navigate back to the form
