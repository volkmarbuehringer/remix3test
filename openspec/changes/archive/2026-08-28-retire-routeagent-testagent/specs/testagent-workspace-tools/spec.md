## REMOVED Requirements

### Requirement: Agent can read file contents

**Reason**: The test agent and its `mastra_workspace_*` file tools are retired.

**Migration**: No replacement. File reading through an agent interface is removed.

#### Scenario: Admin approves file read

- **WHEN** the agent calls `mastra_workspace_read_file`
- **THEN** the system SHALL display an approval dialog showing the file path
- **THEN** upon admin approval, the file content SHALL be returned to the agent

### Requirement: Agent can write files

**Reason**: The test agent and its workspace write tool are retired.

**Migration**: No replacement.

#### Scenario: Agent writes a new file

- **WHEN** the agent calls `mastra_workspace_write_file` with a non-existent path
- **THEN** the system SHALL display an approval dialog with the path and content preview

#### Scenario: Agent overwrites an existing file

- **WHEN** the agent calls `mastra_workspace_write_file` on an existing file it has not read
- **THEN** the tool SHALL reject the operation with a "read before write" error

### Requirement: Agent can edit files

**Reason**: The test agent and its workspace edit tool are retired.

**Migration**: No replacement.

#### Scenario: Admin approves file edit

- **WHEN** the agent calls `mastra_workspace_edit_file` with a file path, search string, and replacement
- **THEN** the system SHALL display an approval dialog showing the diff
- **THEN** upon admin approval, the edit SHALL be applied

### Requirement: Agent can delete files

**Reason**: The test agent and its workspace delete tool are retired.

**Migration**: No replacement.

#### Scenario: Admin approves file deletion

- **WHEN** the agent calls `mastra_workspace_delete`
- **THEN** the system SHALL display an approval dialog showing the path to be deleted

### Requirement: Agent can create directories

**Reason**: The test agent and its workspace mkdir tool are retired.

**Migration**: No replacement.

#### Scenario: Admin approves directory creation

- **WHEN** the agent calls `mastra_workspace_mkdir`
- **THEN** the system SHALL display an approval dialog showing the directory path

### Requirement: Agent can search file contents

**Reason**: The test agent and its workspace grep tool are retired.

**Migration**: No replacement.

#### Scenario: Admin approves content search

- **WHEN** the agent calls `mastra_workspace_grep` with a pattern
- **THEN** the system SHALL return matching file paths and line numbers

### Requirement: Agent can stat files without approval

**Reason**: The test agent and its workspace stat tool are retired.

**Migration**: No replacement.

#### Scenario: Agent stats a file

- **WHEN** the agent calls `mastra_workspace_file_stat` with a file path
- **THEN** the system SHALL return the file's size, type, and modification timestamp without showing an approval dialog

### Requirement: Directory listing stays custom

**Reason**: The test agent and its `listTestFiles` tool are retired.

**Migration**: No replacement — the workspace built-in listing tool remains disabled and unused.

#### Scenario: Agent lists a directory

- **WHEN** the agent needs to list file contents
- **THEN** it SHALL use the custom `listTestFiles` tool, not the workspace built-in