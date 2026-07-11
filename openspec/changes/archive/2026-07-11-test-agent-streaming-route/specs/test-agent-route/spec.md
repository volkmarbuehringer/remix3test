## ADDED Requirements

### Requirement: Test agent has two file-listing tools
The `testAgent` SHALL expose two tools:
- `list_test_files`: lists directory entries (names and type) in the project root, no approval needed
- `read_test_file`: reads file content at a given relative path, SHALL require tool-call approval

#### Scenario: List files in project root
- **WHEN** the agent calls `list_test_files` with no arguments
- **THEN** the tool SHALL return an array of `{ name: string, isDirectory: boolean }` for all entries in the project root directory

#### Scenario: List files in a subdirectory
- **WHEN** the agent calls `list_test_files` with `subdir: "app"`
- **THEN** the tool SHALL return entries in `<cwd>/app/`

#### Scenario: Read file content requires approval
- **WHEN** the agent calls `read_test_file` with `path: "package.json"`
- **THEN** the agent run SHALL suspend and wait for tool-call approval
- **WHEN** the tool call is approved
- **THEN** the tool SHALL return `{ path, content }` with the file's UTF-8 content

#### Scenario: Read file outside project root
- **WHEN** the agent calls `read_test_file` with `path: "../etc/passwd"`
- **THEN** the tool SHALL return `{ error: "Path traversal detected" }` and refuse to read

### Requirement: Test agent runs with `requireToolApproval`
The agent SHALL be invoked with `requireToolApproval` set to a function that returns `true` for `read_test_file` and `false` for `list_test_files`.

#### Scenario: List files streams without suspension
- **WHEN** a user sends "list files" to the test agent
- **THEN** the agent SHALL call `list_test_files`
- **THEN** the agent SHALL stream the response without suspending

#### Scenario: Read file triggers approval card
- **WHEN** a user sends "read package.json" to the test agent
- **THEN** the agent SHALL call `read_test_file`
- **THEN** the stream SHALL suspend
- **THEN** the client SHALL show an approval card with the tool name and file path
- **THEN** the user SHALL be able to approve or decline

### Requirement: Route is top-level and unauthenticated
The `/testagent` route SHALL be at the top level (not under `/admin`), SHALL have no auth middleware, and SHALL be wired in `app/router.ts` via `router.map()`.

#### Scenario: GET /testagent returns page
- **WHEN** a client sends GET `/testagent`
- **THEN** the server SHALL return HTML with the test chat page

#### Scenario: No redirect on unauthenticated access
- **WHEN** an unauthenticated client accesses `/testagent`
- **THEN** the server SHALL return 200 (no redirect to login)

### Requirement: Test chat page has a clientEntry for streaming
The test chat page SHALL include a `clientEntry` component that:
- Intercepts the form submit via `fetch`
- Opens an `EventSource` to the SSE endpoint
- Appends received text tokens to the message area
- Shows an approval card with tool details on `suspension` events
- On approval/decline, POSTs to the approve/decline endpoint and opens a new SSE
- On `complete` event, cleans up and shows final state

#### Scenario: User sends a message
- **WHEN** the user types "list files" and submits the form
- **THEN** the clientEntry SHALL POST the message via fetch
- **THEN** the clientEntry SHALL open an EventSource to the stream endpoint
- **THEN** text tokens SHALL appear in the chat area as they arrive
- **THEN** when streaming completes, the EventSource SHALL close

#### Scenario: User approves a file read
- **WHEN** a suspension event is received with tool details
- **THEN** the clientEntry SHALL render an approval card showing the tool name and arguments
- **WHEN** the user clicks "Approve"
- **THEN** the clientEntry SHALL POST to `/testagent/approve`
- **THEN** the clientEntry SHALL open a new EventSource to the new stream
- **THEN** the file content SHALL stream into the chat area

### Requirement: Test agent uses same model as existing agents
The `testAgent` SHALL use the same model configuration as `supportAgent` and `customerAgent` (provider: `opencode-go`, model: `deepseek-v4-flash`, sourced from `OPENCODE_API_URL`).

#### Scenario: Model config matches
- **WHEN** the test agent is instantiated
- **THEN** its model SHALL use `providerId: 'opencode-go'` and `modelId: 'deepseek-v4-flash'`
