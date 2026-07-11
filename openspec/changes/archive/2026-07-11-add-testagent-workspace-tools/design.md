## Context

The testAgent (`app/actions/mastra/agents/test-agent.ts`) uses a `Workspace` from `@mastra/core/workspace` with a `LocalFilesystem` pointed at the project root. Currently only `mastra_workspace_read_file` is enabled; all other workspace filesystem tools are globally disabled via `tools: { enabled: false }`.

The agent also has a custom `listTestFiles` tool for directory listing, which replaces `mastra_workspace_list_files`.

## Goals / Non-Goals

**Goals:**
- Enable all non-directory filesystem workspace tools on the testAgent
- Every mutation/read tool requires explicit admin approval via the existing approval UI
- FILE_STAT is the exception — it's read-only and harmless, no approval needed
- WRITE_FILE requires read-before-write guard
- Update the agent's instructions so the model knows what tools are available

**Non-Goals:**
- No sandbox/command execution tools (EXECUTE_COMMAND etc.)
- No LSP, search, or indexing tools
- No changes to supportAgent, customerAgent, or other Mastra config
- No changes to the approval UI or SSE streaming logic

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Global tools toggle | Keep `enabled: false`, opt-in per tool | Explicit whitelist prevents any accidental tool exposure |
| File stat approval | None | Returns file metadata only — comparable to what `listTestFiles` already reports |
| Read-before-write on WRITE_FILE | Yes | Prevents overwriting files the agent hasn't seen |
| AST_EDIT | Stay disabled | Complex, niche — can add later if needed |
| Instructions update | Add tool descriptions inline | Current instructions already list tools; new tools need documentation |

## Risks / Trade-offs

- **[Safety]** Enabling write/delete tools gives the agent mutation capability. → Mitigation: `requireApproval: true` on all mutation tools, plus the existing admin auth gate at the controller level.
- **[Scope creep]** Agent could write arbitrary files. → Mitigation: `contained: true` on LocalFilesystem restricts all operations to the project root.
- **[Agent confusion]** More tools means more choices. → Mitigation: Good instructions with clear guidance on when to use each tool.
