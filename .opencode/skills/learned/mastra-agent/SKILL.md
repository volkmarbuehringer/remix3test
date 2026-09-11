---
name: mastra-agent
description: 'Use when building or debugging Mastra agents in Remix — inline model config, single-POST SSE streaming/pipeStream, askUserTool/requireToolApproval suspension, tool-result and message-content handling.'
origin: consolidated
---

# Mastra Agent Patterns

**Consolidated from:** `mastra-agent-inline-model-config`, `mastra-agent-streaming-sse`, `mastra-agent-toolresult-chunk-format`, `mastra-message-content-normalization`

This skill is the **index** for Mastra agent deltas. For the framework API, use the vendor `mastra` skill (`.opencode/skills/mastra/SKILL.md`) and its `references/`.

## Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| Constructing an `Agent` without eager model resolution; registering lazily with `mastra.addAgent()` | `references/model-config.md` |
| Streaming `agent.stream()` over SSE in one POST; `pipeStream`; SSE event types; `askUserTool` question/resume; `requireToolApproval` snapshot loss | `references/sse-streaming.md` |
| Extracting tool output from `agent.generate()` when the shape is chunk vs flat, or when `toolName` is the property key | `references/tool-results.md` |
| Normalizing Mastra's polymorphic `content` (string / v2 parts / `.text` / array) to plain text | `references/message-content.md` |

## Core Rules

- Prefer the **inline model config object** over `model: getModel()` so a missing API key fails only the AI route, not module load / app startup.
- Stream with a **single POST**: call `agent.stream()` inside the action's `ReadableStream.start`, emit a `start` event, then pipe `fullStream` into the same response. No in-memory stream-store, no second endpoint.
- Treat `agent.generate()` tool output as **chunk-or-flat** and iterate `toolResults` directly; `toolName` at runtime is the JavaScript property key, not the `createTool({ id })` value.
- Normalize message `content` at the memory boundary with a shared `messageContentToText()` so every consumer gets `content: string`.

## Related Skills

- `mastra-tools` — approval gating, suspension detection, tool design patterns
- `mastra-workflow` — Workflow resume/abort race and step type compatibility
- `mastra-storage` — PostgresStore-backed observability and storage API usage
- `remix3-agent-routing` — agent-driven frame navigation and form prefill using the `navigate` event
- `remix-security-middleware` — CSRF bypass for SSE endpoints
- `rate-limiter-pitfalls` — rate limiter configuration for multi-step agent flows
