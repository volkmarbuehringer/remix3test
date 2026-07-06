## ADDED Requirements

### Requirement: Admin chatlog viewer reads from Mastra memory
The `/admin/chatlog` route SHALL retrieve conversation history from the Mastra support agent's memory (`agent.getMemory()`) using `listThreads` and `recall`, not from the legacy `chatlog` table.

#### Scenario: List page loads threads from Mastra
- **WHEN** an admin GETs `/admin/chatlog`
- **THEN** the controller SHALL call `memory.listThreads({ page, perPage, orderBy: { field: 'createdAt', direction: 'DESC' } })`
- **AND** it SHALL render the returned threads in the chatlog page, ordered by most recent first

#### Scenario: Detail fragment loads messages for a thread
- **WHEN** an admin requests the chatlog detail fragment for a given `threadId`
- **THEN** the controller SHALL call `memory.recall({ threadId, perPage: false })`
- **AND** it SHALL render the returned messages as the conversation transcript

#### Scenario: No threads exist yet
- **WHEN** `listThreads` returns an empty array
- **THEN** the page SHALL render an empty state with no errors

### Requirement: Admin chatlog viewer is admin-only
The `/admin/chatlog` route SHALL require both `requireAuth()` and `requireAdmin()` middleware, matching the existing access control.

#### Scenario: Non-admin user is denied
- **WHEN** an authenticated non-admin user requests `/admin/chatlog`
- **THEN** the middleware SHALL reject the request before the controller action runs

### Requirement: Chatlog viewer has no chat/agent type distinction
The admin chatlog viewer SHALL NOT expose a `type` query parameter, a chat-only/agent-only filter, or a chat-vs-agent badge on rows. All conversations are rendered uniformly.

#### Scenario: No type filter is accepted
- **WHEN** a request arrives with `?type=chat` or `?type=agent`
- **THEN** the controller SHALL ignore the `type` parameter and render all threads without filtering by type

#### Scenario: Row badge is absent
- **WHEN** the chatlog page renders a thread row
- **THEN** it SHALL NOT display a "Chat" or "Agent" badge based on the presence of tool calls

### Requirement: Chatlog row links point to the mastra chat route
Each thread row in the admin chatlog viewer SHALL link to `/mastra/chat?threadId=<threadId>` so an admin can resume the conversation in the single AI route.

#### Scenario: Row link href
- **WHEN** a thread row with id `t-123` is rendered
- **THEN** the row's "open" link SHALL have `href` equal to `/mastra/chat?threadId=t-123`

### Requirement: Chatlog viewer paginates threads server-side
The admin chatlog viewer SHALL paginate threads using `listThreads` `page`/`perPage` parameters and indicate whether more pages exist, preserving the existing "load N+1 to detect hasMore" UX.

#### Scenario: First page with more available
- **WHEN** the admin opens `/admin/chatlog` and there are more than `perPage` threads
- **THEN** the page SHALL render the first `perPage` threads and a "next page" link

#### Scenario: Page size is preserved from session
- **WHEN** the admin has a page-size preference in their session
- **THEN** the controller SHALL use that page size as `perPage` for `listThreads`

### Requirement: Deleting a thread removes it from Mastra memory
The admin chatlog destroy action SHALL delete a thread via the Mastra memory API (or its underlying storage) and audit-log the deletion, replacing the legacy `deleteConversation` call.

#### Scenario: Delete a thread
- **WHEN** an admin POSTs to `/admin/chatlog/:id/delete` for thread `t-456`
- **THEN** the controller SHALL remove the thread (and its messages) from Mastra memory
- **AND** it SHALL record an `admin_action` audit entry with `target_type: 'chatlog'` and `target_id: 't-456'`
- **AND** it SHALL redirect back to `/admin/chatlog`