## Why

Move the test-agent's file reading from a custom tool to Mastra's built-in workspace `read_file`, while keeping the custom `listTestFiles` for directory listing (the workspace `list_files` doesn't return inline size/mtime that the agent's queries depend on). The workspace also provides containment, tool-approval integration, and a foundation for enabling write/edit/delete/grep tools later.

## What Changes

- Add a `Workspace` with `LocalFilesystem` (contained, basePath: `PROJECT_ROOT`) to the test-agent
- Enable workspace `read_file` (with approval) — all other workspace tools disabled
- Remove custom `readTestFile` tool; keep custom `listTestFiles` tool
- Update agent instructions: reference `mastra_workspace_read_file` for reading, `listTestFiles` for listing
- Update controller's `requireToolApproval` to check `mastra_workspace_read_file`

## Capabilities

### New Capabilities

- `test-agent-workspace`: Workspace-backed file read for the test-agent with built-in containment and tool-approval integration

### Modified Capabilities

- _None_

## Impact

- `app/actions/mastra/agents/test-agent.ts` — add workspace, import `listTestFiles` instead of `testTools`, update instructions
- `app/actions/mastra/tools/test-tools.ts` — remove `readTestFile`, export `listTestFiles` directly
- `app/actions/mastra/tools/test-tools.test.ts` — remove `read_test_file` tests
- `app/actions/test-agent/controller.tsx` — update `requireToolApproval` tool name
