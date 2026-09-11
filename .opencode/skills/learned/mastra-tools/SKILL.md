---
name: mastra-tools
description: 'Use when designing or hard-gating Mastra agent tools — requireApproval + generate(), suspension detection, sequential approval chaining, single-job tool separation, parameter self-lookup, and offset pagination.'
origin: consolidated
---

# Mastra Tools Patterns

**Consolidated from:** `mastra-tool-approval-generate`, `mastra-tool-suspension-detection`, `mastra-tool-offset-pagination`, `mastra-tool-param-self-lookup`, `mastra-tool-single-job-separation`

This skill is the **index** for tool-design deltas. For the base approval API (`requireApproval`, `finishReason: 'suspended'`, `approveToolCallGenerate`/`declineToolCallGenerate`, `requireToolApproval`), use the authoritative `node_modules/@mastra/core/dist/docs/references/docs-agents-agent-approval.md`.

## Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| Hard-gating a destructive tool with `agent.generate()`; the detached-`this` trap; sequential multiple-`requireApproval` chaining; inferring which tool suspended from the payload | `references/approval-gating.md` |
| Designing tools: one job per tool, internal parameter self-lookup instead of asking the LLM, offset pagination for "show more" | `references/tool-design.md` |

## Core Rules

- Call `agent.approveToolCallGenerate(...)` / `declineToolCallGenerate(...)` directly on the agent (or `.call(agent, ...)`) — extracting the method drops `this` and crashes in `resumeGenerate`.
- `approveToolCallGenerate` returns a `FullOutput` with **no** `runId`/`fullStream`; emit a `start` SSE event with the known `runId` first or the client's `currentRunId` stays null and later decisions silently no-op.
- A `requireApproval` suspension payload has `toolCallId`/`toolName`/`args` (not `question`); `askUserTool` has `question`. Branch on the payload shape.
- Look up session/context parameters (admin id/email, IP, tenant, timestamp) inside `execute`, not in the input schema — otherwise the LLM asks the user, confabulates, or skips the tool.
- Give each phase its own single-job tool (lookup → navigate → ask_user → execute) rather than a `confirmed` state flag.

## Related Skills

- `mastra-agent` — SSE streaming, askUserTool/requireApproval transport, tool result extraction
- `mastra-workflow` — Mastra Workflow resume/abort race and step type compatibility
- `remix-security-middleware` — CSRF protection for approval form endpoints
- `remix3-session-flash-frames` — `session.flash()` for one-time approval UI routing decisions
