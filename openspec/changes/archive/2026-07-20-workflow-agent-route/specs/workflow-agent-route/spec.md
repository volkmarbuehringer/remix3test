## ADDED Requirements

### Requirement: New admin route /admin/workflow-agent

The system SHALL provide a new admin-only route at `/admin/workflow-agent` with a chat-based agent interface and SSE streaming.

#### Scenario: Route renders full page with frame layout
- **WHEN** an admin visits `/admin/workflow-agent`
- **THEN** the system renders a full-page layout with a chat input at the bottom and an `admin-content` frame above

#### Scenario: Route returns panel content for frame requests
- **WHEN** the admin-content frame requests `/admin/workflow-agent/panel`
- **THEN** the system returns a placeholder panel asking the admin to ask a question

#### Scenario: Non-admin gets 403
- **WHEN** a non-admin user visits `/admin/workflow-agent`
- **THEN** the system returns a 403 response

#### Scenario: Route is registered in sidebar
- **WHEN** the admin sidebar renders
- **THEN** the system SHALL show a "Workflow-Agent" entry that links to `/admin/workflow-agent`

### Requirement: Workflow agent with typed workflow tools

The system SHALL provide a `workflowAgent` with one typed tool per workflow: `cancelUserWorkflow_v2`, `lockUserWorkflow_v2`, `unlockUserWorkflow_v2`. Each tool SHALL have an explicit `inputSchema` matching the workflow's required parameters.

#### Scenario: Agent matches cancel intent to cancelUserWorkflow_v2
- **WHEN** an admin types "cancel user 42" or "remove user 42 from the system"
- **THEN** the agent SHALL call `cancelUserWorkflow_v2` with `targetUserId: 42`

#### Scenario: Agent matches lock intent to lockUserWorkflow_v2
- **WHEN** an admin types "lock user 42" or "disable user 42"
- **THEN** the agent SHALL call `lockUserWorkflow_v2` with `targetUserId: 42`

#### Scenario: Agent matches unlock intent to unlockUserWorkflow_v2
- **WHEN** an admin types "unlock user 42" or "re-enable user 42"
- **THEN** the agent SHALL call `unlockUserWorkflow_v2` with `targetUserId: 42`

#### Scenario: Agent uses askUser for ambiguous input
- **WHEN** the admin's request doesn't clearly map to a single workflow or user ID
- **THEN** the agent SHALL use askUserTool to clarify before calling any workflow tool

### Requirement: SSE streaming for agent responses

The route SHALL stream agent responses as SSE events using the same infrastructure as the existing route-agent.

#### Scenario: Action endpoint returns SSE stream
- **WHEN** the admin submits a message via POST to `/admin/workflow-agent`
- **THEN** the system returns a `text/event-stream` response with `start`, `message`, `question`, `suspension`, `navigate`, `tool-result`, and `complete` events

#### Scenario: Answer endpoint resumes suspended agent
- **WHEN** the admin responds to an `askUser` question via POST to `/admin/workflow-agent/answer`
- **THEN** the system resumes the agent stream and continues with SSE events

#### Scenario: Tool decision endpoint handles approvals
- **WHEN** the admin approves or declines a tool call via POST to `/admin/workflow-agent/tool-decision`
- **THEN** the system processes the decision and streams the result

### Requirement: Navigate-confirm pattern in workflow tools

Each workflow tool SHALL embed a lookup → navigate → confirm → execute sequence, where the confirmation happens via askUserTool suspension.

#### Scenario: cancelUserWorkflow_v2 navigates to user and confirms
- **WHEN** `cancelUserWorkflow_v2` is called with a valid `targetUserId`
- **THEN** the tool SHALL look up the user by ID, navigate the frame to `/admin/users?editing=<id>`, and suspend with an askUser question asking the admin to review and confirm

#### Scenario: cancelUserWorkflow_v2 checks pending appointments after confirm
- **WHEN** the admin confirms the lock
- **THEN** the tool SHALL query for the user's pending future appointments
- **IF** pending appointments exist, the tool SHALL suspend with an askUser question asking whether to delete them
- **IF** no pending appointments exist, the tool SHALL proceed to execute the cancel workflow

#### Scenario: lockUserWorkflow_v2 navigates and confirms
- **WHEN** `lockUserWorkflow_v2` is called with a valid `targetUserId`
- **THEN** the tool SHALL look up the user, navigate to `/admin/users?editing=<id>`, and ask the admin to confirm before executing the lock

#### Scenario: unlockUserWorkflow_v2 navigates and confirms
- **WHEN** `unlockUserWorkflow_v2` is called with a valid `targetUserId`
- **THEN** the tool SHALL look up the user, navigate to `/admin/users?editing=<id>`, and ask the admin to confirm before executing the unlock

### Requirement: Rate limiting

The route SHALL apply per-IP rate limiting using the same pattern as the route-agent.

#### Scenario: Rate limited client receives 429
- **WHEN** a client exceeds the rate limit
- **THEN** the system SHALL return a 429 response with an SSE `agent-error` event

### Requirement: No changes to existing code

The new route and agent SHALL NOT modify existing files in `app/actions/mastra/controller.tsx`, `app/actions/mastra/agents/support-agent.ts`, or `app/actions/mastra/tools/support-tools.ts`.

#### Scenario: Existing support agent continues to work
- **WHEN** an admin visits `/mastra/chat`
- **THEN** the existing support agent SHALL function identically to before this change
