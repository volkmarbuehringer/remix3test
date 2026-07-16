## Purpose

Defines the filesystem workspace toolset available to the testAgent — a Mastra agent used for project exploration and file management. All mutation tools require admin approval; read-only tools (stat) do not.

## Requirements

### Requirement: Agent can read file contents

The testAgent SHALL be able to read the content of any file within the project directory using the `mastra_workspace_read_file` tool. This operation SHALL require explicit admin approval before execution.

#### Scenario: Admin approves file read

- **WHEN** the agent calls `mastra_workspace_read_file`
- **THEN** the system SHALL display an approval dialog showing the file path
- **THEN** upon admin approval, the file content SHALL be returned to the agent

### Requirement: Agent can write files

The testAgent SHALL be able to write content to files within the project directory using the `mastra_workspace_write_file` tool. The agent MUST read a file before overwriting it (requireReadBeforeWrite). File write operations SHALL require explicit admin approval.

#### Scenario: Agent writes a new file

- **WHEN** the agent calls `mastra_workspace_write_file` with a non-existent path
- **THEN** the system SHALL display an approval dialog with the path and content preview

#### Scenario: Agent overwrites an existing file

- **WHEN** the agent calls `mastra_workspace_write_file` on an existing file it has not read
- **THEN** the tool SHALL reject the operation with a "read before write" error

### Requirement: Agent can edit files

The testAgent SHALL be able to perform search-and-replace edits on files using the `mastra_workspace_edit_file` tool. Edit operations SHALL require explicit admin approval.

#### Scenario: Admin approves file edit

- **WHEN** the agent calls `mastra_workspace_edit_file` with a file path, search string, and replacement
- **THEN** the system SHALL display an approval dialog showing the diff
- **THEN** upon admin approval, the edit SHALL be applied

### Requirement: Agent can delete files

The testAgent SHALL be able to delete files within the project directory using the `mastra_workspace_delete` tool. Delete operations SHALL require explicit admin approval.

#### Scenario: Admin approves file deletion

- **WHEN** the agent calls `mastra_workspace_delete`
- **THEN** the system SHALL display an approval dialog showing the path to be deleted

### Requirement: Agent can create directories

The testAgent SHALL be able to create directories within the project directory using the `mastra_workspace_mkdir` tool. Directory creation SHALL require explicit admin approval.

#### Scenario: Admin approves directory creation

- **WHEN** the agent calls `mastra_workspace_mkdir`
- **THEN** the system SHALL display an approval dialog showing the directory path

### Requirement: Agent can search file contents

The testAgent SHALL be able to search file contents using the `mastra_workspace_grep` tool with regex patterns. Content search SHALL require explicit admin approval.

#### Scenario: Admin approves content search

- **WHEN** the agent calls `mastra_workspace_grep` with a pattern
- **THEN** the system SHALL return matching file paths and line numbers

### Requirement: Agent can stat files without approval

The testAgent SHALL be able to retrieve file metadata (size, type, modification time) using the `mastra_workspace_file_stat` tool. This operation SHALL NOT require approval.

#### Scenario: Agent stats a file

- **WHEN** the agent calls `mastra_workspace_file_stat` with a file path
- **THEN** the system SHALL return the file's size, type, and modification timestamp without showing an approval dialog

### Requirement: Directory listing stays custom

The built-in `mastra_workspace_list_files` tool SHALL remain disabled. The agent SHALL use the custom `listTestFiles` tool for directory listing instead.

#### Scenario: Agent lists a directory

- **WHEN** the agent needs to list file contents
- **THEN** it SHALL use the custom `listTestFiles` tool, not the workspace built-in
