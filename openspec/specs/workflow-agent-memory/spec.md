## ADDED Requirements

### Requirement: Per-admin conversation memory

The workflow agent SHALL maintain persistent conversation memory keyed by admin user ID. The memory SHALL persist across browser sessions and logins. The agent SHALL use the Mastra `Memory` module with PostgresStore backing.

#### Scenario: Agent remembers prior turn context

- **WHEN** an admin asks "lock user 5" and the agent resolves the intent
- **THEN** the agent stores the resolved intent in the memory thread for `admin-{userId}`

#### Scenario: Follow-up query resolves from memory

- **WHEN** the same admin later asks "now unlock them"
- **THEN** the agent SHALL resolve "them" to the user from the prior turn using thread memory

#### Scenario: Different admins have separate threads

- **WHEN** admin A and admin B each send messages to the agent
- **THEN** each admin SHALL have their own thread keyed by their user ID

#### Scenario: Thread key includes environment scope

- **WHEN** the same admin exists in both development and production databases
- **THEN** their thread keys SHALL differ based on `NODE_ENV` or `APP_ENV`

### Requirement: Workflow result feedback

After a workflow completes (or fails), the agent SHALL receive a structured summary of the result appended to its memory thread. The feedback call SHALL be best-effort and MUST NOT block the SSE stream from delivering the `complete` event to the client.

#### Scenario: Successful workflow feeds result back to agent

- **WHEN** a lock/cancel/unlock workflow completes successfully
- **THEN** the agent's thread SHALL receive a message containing the workflow result including `action`, `targetUserId`, `targetUserName`, `auditLogged`, and `success` status

#### Scenario: Failed workflow feeds error back to agent

- **WHEN** a workflow fails (e.g., user not found, validation error)
- **THEN** the agent's thread SHALL receive a message containing the `error` field alongside the `success: false` status

#### Scenario: Feedback does not delay SSE delivery

- **WHEN** the workflow SSE stream emits `workflow-finish`
- **THEN** the controller SHALL close the SSE stream (`complete` event) before making the feedback `generate()` call

#### Scenario: Feedback failure is non-blocking

- **WHEN** the post-workflow `generate()` call throws an error
- **THEN** the controller SHALL catch the error silently without affecting the already-closed SSE response

### Requirement: pipeWorkflowStream returns structured result

The `pipeWorkflowStream` function SHALL return a `WorkflowResult` object extracted from the `workflow-finish` SSE event. The return type MUST include `success`, `action`, `targetUserId`, `targetUserName`, and optionally `error`, `deletedAppointments`, and `auditLogged`.

#### Scenario: Result returned after stream completes

- **WHEN** `pipeWorkflowStream` finishes consuming the workflow stream
- **THEN** it SHALL return a `WorkflowResult` object with data from the final workflow step output

#### Scenario: Error during stream returns error result

- **WHEN** the workflow stream errors before producing `workflow-finish`
- **THEN** `pipeWorkflowStream` SHALL return `{ success: false, error: "<error message>" }`
