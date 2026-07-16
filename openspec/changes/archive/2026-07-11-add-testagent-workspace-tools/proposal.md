## Why

The testAgent currently has only 2 tools (`listTestFiles` + `mastra_workspace_read_file`), making it barely useful for project exploration. It can list files and read them, but cannot search file contents, write files, edit code, create directories, delete files, or even stat a file. Adding the remaining workspace filesystem tools (with approval gating) transforms it into a genuinely useful exploratory and maintenance agent.

## What Changes

- `app/actions/mastra/agents/test-agent.ts` — expand the `tools` config on the `Workspace` constructor to enable these filesystem tools with `requireApproval: true`:

  | Tool                          | Setting                                                         |
  | ----------------------------- | --------------------------------------------------------------- |
  | `mastra_workspace_read_file`  | keep enabled, `requireApproval: true`                           |
  | `mastra_workspace_write_file` | enable, `requireApproval: true`, `requireReadBeforeWrite: true` |
  | `mastra_workspace_edit_file`  | enable, `requireApproval: true`                                 |
  | `mastra_workspace_delete`     | enable, `requireApproval: true`                                 |
  | `mastra_workspace_mkdir`      | enable, `requireApproval: true`                                 |
  | `mastra_workspace_grep`       | enable, `requireApproval: true`                                 |
  | `mastra_workspace_file_stat`  | enable, **no approval** (read-only, harmless)                   |
  | `mastra_workspace_list_files` | stay disabled (replaced by custom `listTestFiles`)              |
  | `mastra_workspace_ast_edit`   | stay disabled (niche, not needed)                               |

- Update the agent's `instructions` string to document the new tools.

## Capabilities

### New Capabilities

- `testagent-workspace-tools`: Filesystem tool configuration for the testAgent workspace — write, edit, delete, mkdir, grep, and stat operations on the project directory, all approval-gated.

### Modified Capabilities

None — this is additive configuration, no existing spec changes.

## Impact

- **Affected code**: `app/actions/mastra/agents/test-agent.ts` only
- **No new dependencies**
- **No API changes** — all tools are already bundled in `@mastra/core/workspace`, just not enabled
- **Safety**: Every destructive tool requires explicit user approval via the existing approval UI
