## ADDED Requirements

### Requirement: Agent reads files via workspace tool

The test-agent SHALL use the workspace `read_file` tool instead of the custom `readTestFile` tool to read file contents. The tool SHALL require user approval before executing.

#### Scenario: Read file with approval

- **WHEN** the agent calls the workspace read_file tool
- **THEN** the system suspends execution and sends a `tool-call-approval` SSE event

#### Scenario: Admin approves read

- **WHEN** the admin clicks approve for a read_file suspension
- **THEN** the system reads the file and resumes the stream with content

#### Scenario: Admin declines read

- **WHEN** the admin clicks decline for a read_file suspension
- **THEN** the system returns a decline message and resumes the stream without file content

#### Scenario: Path traversal protection

- **WHEN** the agent attempts to read a file outside the project root
- **THEN** the workspace containment SHALL reject the operation

### Requirement: Agent lists files via custom listTestFiles tool

The test-agent SHALL use the custom `listTestFiles` tool to enumerate directory contents with inline size and mtime fields. The workspace `list_files` tool SHALL remain disabled because its output lacks the inline stat data needed for size/newest-file queries.

#### Scenario: List with inline size and mtime

- **WHEN** the agent calls listTestFiles
- **THEN** the response SHALL include name, size (bytes), mtime (Unix ms), and display hints (formattedSize, type, icon)

#### Scenario: Sort by size or mtime

- **WHEN** the agent calls listTestFiles with sort="size" or sort="mtime"
- **THEN** results SHALL be sorted descending by the requested field

#### Scenario: Path traversal protection

- **WHEN** listTestFiles receives a path like "../etc"
- **THEN** the tool SHALL return an error

### Requirement: Disabled tools are unavailable

All workspace tools except `read_file` SHALL be disabled and SHALL NOT appear in the agent's toolset.

#### Scenario: Write tool not available

- **WHEN** the agent checks its available tools
- **THEN** `mastra_workspace_write_file` SHALL NOT be present

#### Scenario: List tool not available

- **WHEN** the agent checks its available tools
- **THEN** `mastra_workspace_list_files` SHALL NOT be present
