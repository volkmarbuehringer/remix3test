---
name: mastra-agent
description: 'Use when building or debugging Mastra agents in Remix — inline model config, single-POST SSE streaming/pipeStream, askUserTool/requireToolApproval suspension (including restoring a pending gate after reload and durable run ownership), tool-result and message-content handling, and PostgresStore-backed observability.'
origin: consolidated
---

# Mastra Agent Patterns

**Consolidated from:** `mastra-agent-inline-model-config`, `mastra-agent-streaming-sse`, `mastra-agent-toolresult-chunk-format`, `mastra-message-content-normalization`, `mastra-observability-postgres-store`, `mastra-storage-api-vs-raw-sql`, `mastra-agent-pending-gate-restore`, `mastra-durable-run-ownership`

This skill is the **index** for Mastra agent deltas. For the framework API, use the vendor `mastra` skill (`.opencode/skills/mastra/SKILL.md`) and its `references/`.

## Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| Constructing an `Agent` without eager model resolution; registering lazily with `mastra.addAgent()` | `references/model-config.md` |
| Streaming `agent.stream()` over SSE in one POST; `pipeStream`; SSE event types; client/server event-contract drift; `askUserTool` question/resume; `requireToolApproval` snapshot loss | `references/sse-streaming.md` |
| Extracting tool output from `agent.generate()` when the shape is chunk vs flat, or when `toolName` is the property key | `references/tool-results.md` |
| Normalizing the polymorphic `content` (string / v2 parts / `.text` / array) to plain text | `references/message-content.md` |
| Adding observability to a PostgresStore-backed Mastra without DuckDB or LibSQL | `references/observability-postgres-store.md` |
| Redacting PII, sampling spans, or sizing high-volume trace storage | `references/observability-postgres-store.md` |
| Deleting a library-managed storage row, or tempted to `DELETE FROM mastra_*` directly | `references/storage-api-vs-raw-sql.md` |
| A suspended `ask_user`/approval card is missing after reload and the user must retype | `references/pending-gate-restore.md` |
| Approve/decline/answer returns 403 after restart/scale or on a re-suspended run | `references/durable-run-ownership.md` |

## Core Rules

- Prefer the **inline model config object** over `model: getModel()` so a missing API key fails only the AI route, not module load / app startup.
- Stream with a **single POST**: call `agent.stream()` inside the action's `ReadableStream.start`, emit a `start` event, then pipe `fullStream` into the same response. No in-memory stream-store, no second endpoint.
- Treat `agent.generate()` tool output as **chunk-or-flat** and iterate `toolResults` directly; `toolName` at runtime is the JavaScript property key, not the `createTool({ id })` value.
- Normalize message `content` at the memory boundary with a shared `messageContentToText()` so every consumer gets `content: string`.
- **PostgresStore already composes observability** (all domain classes, including `ObservabilityPG`; `init()` creates the tables). The Studio `MastraCompositeStore` + `LibSQLStore` + `DuckDBStore` wiring is unnecessary on Postgres — install `@mastra/observability` and wire `Observability` + `MastraStorageExporter` into the existing `Mastra()`.
- **No sampling by default** (100% of spans persisted); `SensitiveDataFilter` redacts only by key name, not free-form PII. Past roughly 1,500 spans/sec, move observability to DuckDB/ClickHouse.
- **Use the storage API, not raw SQL**, when the API has side effects: `memory.deleteThread(id)` handles all cleanup. Raw `DELETE FROM mastra_*` couples to private schema, is non-atomic, orphans vector embeddings, and skips future cleanup. If unavoidable, wrap in a transaction and document the coupling.
- **A suspended gate must be restorable**: the card is live-SSE-only, so persist a per-actor gate payload and expose a `reconnect` endpoint the client calls on mount — joining the ownership table and filtering `status = 'suspended'` so a settled run is never surfaced. Reuse one `gateHooks(...)` helper across the initial/tool-decision/answer streams.
- **Ownership must be durable**: persist a `run_id` to `user_id` pointer for the 403 gate (do not reuse the admin-only `admin_active_runs`). Record on start **and** every continuation, and clear the incoming run only when a **distinct** continuation run was created — a stale row is cheaper than a false 403. Insert idempotently (`ON CONFLICT (run_id) DO NOTHING`); add the table to both `db/schema.sql` and the `remix/data-table` DSL.

## Related Skills

- `mastra-tools` — approval gating, suspension detection, tool design patterns
- `mastra-workflow` — Workflow resume/abort race and step type compatibility
- `remix3-agent-routing` — agent-driven frame navigation and form prefill using the `navigate` event
- `security-gotchas` (`references/security-middleware.md`) — CSRF bypass for SSE endpoints
- `rate-limiter-pitfalls` — rate limiter configuration for multi-step agent flows
