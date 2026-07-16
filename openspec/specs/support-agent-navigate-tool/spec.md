## ADDED Requirements

### Requirement: Support agent has routeNavigate tool

The support agent SHALL have the `routeNavigate` tool available. The tool SHALL accept `{ path, query?, data? }` and return `{ type: 'route', path }`, matching the existing implementation in `app/actions/mastra/tools/route-navigate.ts`.

#### Scenario: Agent can navigate to a path

- **WHEN** the support agent calls `routeNavigate({ path: '/admin/users' })`
- **THEN** the tool SHALL return `{ type: 'route', path: '/admin/users' }`
- **AND** the existing SSE pipe in `agent-sse.ts:filterAndForward` SHALL emit a `navigate` SSE event
- **AND** the `SupportAgentStream` clientEntry SHALL execute `handleNavigate()` and load the target page in the primary frame

#### Scenario: Agent can navigate with query params

- **WHEN** the support agent calls `routeNavigate({ path: '/admin/users', query: { filter: 'smith' } })`
- **THEN** the returned path SHALL include query parameters: `/admin/users?filter=smith`

#### Scenario: Invalid path is rejected

- **WHEN** the support agent calls `routeNavigate({ path: 'https://evil.com' })`
- **THEN** the tool SHALL return `{ type: 'error', error: 'path must be a relative route starting with /' }`

### Requirement: Agent instructions mention navigation capability

The support agent instructions SHALL include a statement that the agent can navigate to pages using the navigate tool, without prescribing specific route-to-query mappings.

#### Scenario: Instructions mention navigation

- **WHEN** the support agent instructions are loaded
- **THEN** they SHALL include text indicating the `navigate` tool is available for showing pages in the frame
- **AND** they SHALL NOT include specific rules mapping queries to routes
