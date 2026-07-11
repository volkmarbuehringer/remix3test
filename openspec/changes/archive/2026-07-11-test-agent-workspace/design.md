## Context

The test-agent is an admin-facing exploration interface at `/testagent`. It uses two custom tools: `listTestFiles` (rich listing with size/mtime/sort/filter) and `readTestFile` (read with approval). Mastra's `@mastra/core` workspace API provides built-in equivalents plus containment and tool-approval config.

The workspace `list_files` outputs a tree structure without inline size/mtime, so the custom `listTestFiles` is kept for listing. The workspace `read_file` replaces `readTestFile` cleanly — it supports the same containment and approval flow.

## Goals / Non-Goals

**Goals:**
- Replace `readTestFile` with workspace `read_file` (with approval)
- Keep custom `listTestFiles` for directory listing with inline size/mtime
- Add a workspace to the test-agent for future extensibility
- Share a single `PROJECT_ROOT` constant between both tools

**Non-Goals:**
- Replacing `listTestFiles` with workspace `list_files` (lacks inline stat data)
- Adding sandbox/command execution
- Enabling write/edit/delete/grep tools
- Changing the SSE protocol or approve/decline flow

## Decisions

**1. Shared PROJECT_ROOT constant**
`test-tools.ts` exports `PROJECT_ROOT` (resolved via `realpathSync(process.cwd())`). `test-agent.ts` imports it for the workspace `basePath`. Eliminates drift between the two tools and avoids `process.env.HOME` being undefined.

**2. Workspace on agent-level, not global**
Keeps filesystem access scoped to the test-agent; other agents don't inherit it.

**3. Global `enabled: false` with per-tool opt-in for read_file**
Only `read_file` is explicitly enabled. All other workspace tools remain inactive. Makes the restriction obvious.

**4. Tool names stay as defaults**
Controller checks `mastra_workspace_read_file`. No remapping needed.

## Risks / Trade-offs

- [Compatibility] If a future Mastra upgrade changes workspace tool names, the controller check breaks. Mitigation: caught at startup via stream error.
- [Confusion risk] Agent has two separate tools from different sources — `listTestFiles` (custom) and `mastra_workspace_read_file` (workspace). Instructions call each out by name to guide routing.
