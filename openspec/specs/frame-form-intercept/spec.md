## Purpose

The support agent frame intercepts form submissions within its primary frame to prevent top-level page navigation that would destroy the agent bar and input box. Intercepted forms are sent via fetch, the frame is reloaded to reflect changes, and results are optionally fed back to the agent during pending questions.

## ADDED Requirements

### Requirement: Support agent intercepts frame form submissions

The support agent client entry SHALL register a `submit` event listener on its frame container element (`#support-agent-frame-container`) that intercepts all form submissions originating from within the frame. Intercepted forms SHALL be sent via `fetch()` instead of browser-native submission, preventing top-level page navigation.

#### Scenario: Form inside frame is submitted

- **WHEN** a form inside the support agent's frame is submitted
- **THEN** the `submit` event SHALL be intercepted by the container listener
- **AND** `e.preventDefault()` SHALL be called
- **AND** the form data SHALL be sent via `fetch()` to the form's action URL using the form's method
- **AND** after the fetch completes, the active frame SHALL be reloaded using `handle.frames.get(activeFrame).reload()`

#### Scenario: Intercept does not affect the agent's own input form

- **WHEN** `#support-agent-form` is submitted
- **THEN** the frame container intercept SHALL NOT interfere
- **AND** the existing `handleFormSubmit` handler SHALL process it as before

#### Scenario: Fetch response is followed through redirects

- **WHEN** the form's action returns a redirect (302)
- **THEN** the `fetch()` SHALL follow the redirect to the final response
- **AND** the frame SHALL be reloaded at its current URL (the server has already processed the action)

#### Scenario: GET form submissions are not intercepted

- **WHEN** a form with `method="GET"` is submitted inside the frame
- **THEN** the intercept SHALL NOT prevent default behavior
- **AND** the form SHALL be handled by the Frame Navigation API via `rmx-target`

#### Scenario: Concurrent submissions are blocked

- **WHEN** a form submission is in progress
- **THEN** a second concurrent submission SHALL be ignored

### Requirement: Agent receives feedback from form submission during pending question

When a frame form submission is intercepted and a pending agent question exists, the handler SHALL parse the fetch response and feed it back to the agent as an answer, so the agent can continue its workflow.

#### Scenario: JSON response is fed to agent during pending question

- **WHEN** the intercepted form's fetch response has status 200 and `Content-Type: application/json`
- **AND** a pending agent question exists (`pendingQuestion` is set)
- **THEN** the response body SHALL be parsed as JSON
- **AND** the parsed data SHALL be sent as an answer via the `/admin/support-agent/answer` SSE endpoint
- **AND** the agent SHALL resume with the answer

#### Scenario: Error JSON response is not fed to agent

- **WHEN** the fetch response has a 4xx or 5xx status code
- **AND** `Content-Type` is `application/json`
- **THEN** the response SHALL NOT be fed to the agent

#### Scenario: Non-JSON response reloads frame without agent feedback

- **WHEN** the intercepted form's fetch response does not have `Content-Type: application/json`
- **AND** a pending agent question exists
- **THEN** the frame SHALL be reloaded
- **AND** the agent SHALL NOT receive structured feedback
