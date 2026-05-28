## ADDED Requirements

### Requirement: Workflow route is accessible at /ai/workflow

The system SHALL provide a workflow route under the `/ai/` prefix at `/ai/workflow`.

#### Scenario: Workflow index returns 200
- **WHEN** an authenticated user sends a GET request to `/ai/workflow`
- **THEN** the server SHALL return a 200 response with the workflow index page

#### Scenario: Workflow index lists available workflows
- **WHEN** an authenticated user visits `/ai/workflow`
- **THEN** the page SHALL display a list of registered workflow definitions

#### Scenario: Workflow index shows recent runs
- **WHEN** an authenticated user visits `/ai/workflow`
- **THEN** the page SHALL display recent workflow runs with status

#### Scenario: Workflow run detail page
- **WHEN** an authenticated user visits `/ai/workflow?runId=<id>`
- **THEN** the server SHALL display the run detail page with steps, status, and results

### Requirement: User can trigger a workflow run

The system SHALL allow authenticated users to trigger a new workflow run via POST to `/ai/workflow`.

#### Scenario: POST triggers workflow execution
- **WHEN** an authenticated user POSTs to `/ai/workflow` with a valid `workflowId`
- **THEN** the server SHALL create a new workflow run and redirect to the run detail page

#### Scenario: POST with parameters passes them to workflow
- **WHEN** an authenticated user POSTs to `/ai/workflow` with `workflowId` and matching parameter fields
- **THEN** the parameters SHALL be passed to the workflow execution

### Requirement: Workflow runs are persisted

The system SHALL persist workflow runs in the `workflow_runs` database table.

#### Scenario: Run is created in database
- **WHEN** a workflow run is triggered
- **THEN** a new record SHALL be inserted into `workflow_runs` with status, params, and timestamps

#### Scenario: Run status updates during execution
- **WHEN** a workflow executes
- **THEN** the run status SHALL be updated from `pending` → `running` → `completed` or `failed`

### Requirement: Workflow route requires authentication

The workflow route SHALL require authenticated access, consistent with other AI routes.

#### Scenario: Unauthenticated user is redirected
- **WHEN** an unauthenticated user visits `/ai/workflow`
- **THEN** the server SHALL redirect to `/login`

### Requirement: Workflow UI uses newapp theme and Button component

The workflow UI pages SHALL use newapp's theme system (`app/theme.tsx`) and `Button` from `remix/ui/button`.

#### Scenario: Theme tokens are used for styling
- **WHEN** a workflow page is rendered
- **THEN** CSS SHALL use theme tokens (theme.colors, theme.surface, theme.space, etc.) instead of hardcoded values

#### Scenario: Buttons use Button component
- **WHEN** a submit button or action button is rendered
- **THEN** it SHALL use the `Button` component from `remix/ui/button` with appropriate `tone` prop

### Requirement: Workflow navigation link

The navigation SHALL include a link to the Workflows page under the AI section.

#### Scenario: Nav has Workflows link
- **WHEN** the navigation renders
- **THEN** it SHALL include a "Workflows" link pointing to `/ai/workflow`

### Requirement: Workflow engine supports multi-step execution with tools

The workflow engine SHALL support async generator-based multi-step workflows with tool integration.

#### Scenario: Workflow runs with LLM and tools
- **WHEN** a workflow that uses tools (e.g., get_weather, search_wikipedia) is executed
- **THEN** the engine SHALL invoke those tools during step execution and persist results

#### Scenario: Workflow steps are persisted
- **WHEN** a workflow step completes
- **THEN** the step output SHALL be persisted in the run's steps data
