## REMOVED Requirements

### Requirement: Test agent SHALL require approval before reading files

**Reason**: The legacy `read_test_file` tool and the test agent that used it are retired.

**Migration**: No replacement. The test-agent route and its approval card UI are removed.

#### Scenario: User sends a message that triggers read_test_file

- **WHEN** a user sends a message that causes the agent to call `readTestFile`
- **THEN** the agent SHALL suspend the tool call and emit a `suspension` SSE event with `toolName: "readTestFile"` and the file path in `args`
- **AND** the approval card SHALL appear in the UI

#### Scenario: User approves the tool call

- **WHEN** the user clicks "Approve" on the approval card
- **THEN** the agent SHALL execute `readTestFile` with the specified path
- **AND** the file content SHALL be returned to the user

#### Scenario: User declines the tool call

- **WHEN** the user clicks "Decline" on the approval card
- **THEN** the agent SHALL NOT execute `readTestFile`
- **AND** the agent SHALL continue generating a response explaining the decision