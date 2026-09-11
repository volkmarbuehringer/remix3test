---
name: mastra-workflow
description: 'Use when debugging Mastra Workflow — SSE resume/abort race with server-side state, strict step schema types in `.parallel()`/`.then()`, reader-cancel reconnect recovery, or plain-object failed-run `result.error`.'
origin: consolidated
---

# Mastra Workflow Patterns

**Consolidated from:** `mastra-workflow-resume-abort-race`, `mastra-workflow-step-type-compatibility`

This skill is the **index** for Mastra Workflow deltas. For the streaming transport, see `mastra-agent`; for confirmation-gate tools, see `mastra-tools`.

## Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| Client aborts the SSE stream then resumes a suspended workflow; server-side Map/cache cleanup races the resume | `references/resume-abort-race.md` |
| TS errors about `inputSchema` compatibility in `.parallel()` or output/input mismatch across `.then()` chains | `references/step-schema-types.md` |
| Reconnect/re-attach after a reader cancel (run stays `running`, snapshot `suspended`), or `[object Object]` from a failed run's `result.error` | `references/reconnect-and-error-mapping.md` |

## Core Rules

- Do not rely on server-side state that is cleaned up on request abort — pass the `workflowId` through the SSE `start` event and send it back on resume.
- All `.parallel()` steps must accept the workflow's `inputSchema`; each `.then()` step's input must match the previous step's output. Compose at the executor level when they don't.
- Cancelling the SSE reader does **not** abort the run: a live `running` snapshot is "still in flight", not stale; source the gate payload from the snapshot when the index payload is `NULL`.
- `result.error` on a failed run is a plain serialized object, not an `Error` — map it through `runErrorMessage(error)` at one choke point.

## Related Skills

- `mastra-agent` — SSE streaming transport shared with workflow streaming
- `mastra-tools` — confirmation-gate tools (`requireApproval`, `ask_user`) that suspend agents and workflows
