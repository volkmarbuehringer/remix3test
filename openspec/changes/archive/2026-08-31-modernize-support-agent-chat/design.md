## Context

See `proposal.md` — Why. The support-agent chat today has two gaps, both inherited from the fact that the controller streams one-shot SSE events with no durable state:

1. A suspended tool decision or `ask_user` gate is emitted as an SSE `question` / `suspension` event and lost on reload/tab-switch/restart. `app/actions/support-agent/controller.tsx` holds no per-admin state; nothing re-reads it on load.
2. Single-select clarifications are collected with native `window.prompt()` in `app/assets/streams/public/support-agent-stream.tsx` (`showQuestion`), and tool results are only streamed as text.

The sibling pipelines already solve both problems and are the templates to mirror:
- `app/actions/agent-events/` owns a durable per-admin active-run index (`active-run-store.ts` backed by the `admin_active_runs` table) and a non-mutating `reconnect` GET action (`get('/reconnect')`), with the client re-rendering the confirm gate on load.
- `app/actions/mastra/tools/route-navigate.ts`, the `structured-question-ui` and `structured-tool-output` specs define the structured UI + typed-output conventions.

## Goals / Non-Goals

**Goals:**
- Persist the support agent's pending gate per admin so it survives reload/restart, and add a non-mutating reconnect surface + client resurface on load.
- Resolve approve/decline/answer from the durable index when the run is not otherwise determinable.
- Replace `window.prompt()` with a rendered in-chat question card (single + multi select).
- Render tool results as structured output (table/list/detail card/download) instead of raw text only.
- Stay inside the existing read-only boundary; keep route map and frame target unchanged.

**Non-Goals:**
- No change to the support agent's tool inventory, account-mutation boundary (still the agent-events pipeline's job), or the `support-agent-panel` frame layout.
- Not generalizing the agent-events run store; the support agent gets its own store module.
- Not reworking chat threading beyond the pending-gate resume (that is `workflow-agent-memory` territory).

## Decisions

**1. Dedicated `support_agent_pending_gates` table + store module, not reuse of `admin_active_runs`.**
The support agent's pending gate tracks `run_id`, `thread_id`, `tool_call_id`, `tool_name`, `args`, `gate_type` (tool-decision vs question), and `suspend_payload` — a different shape than the workflow run's `workflow_id`/`step_id`. Reusing `admin_active_runs` would force a unioned schema and conflate two independent pipelines. Mirror the repo pattern (one store per agent pipeline) as `app/actions/support-agent/run-store.ts`, with idempotent-ish DDL added to `db/schema.sql` (`CREATE TABLE IF NOT EXISTS ... support_agent_pending_gates (admin_user_id PRIMARY KEY ..., run_id, thread_id, tool_call_id, tool_name, args JSONB, gate_type, suspend_payload JSONB, created_at, updated_at)`) plus `CREATE INDEX IF NOT EXISTS ... ON ... (run_id)`.
- *Alternative considered*: reuse `admin_active_runs`. Rejected — schema mismatch and cross-pipeline coupling; the `agent-events` table is semantically about workflow runs, not tool gates.

**2. Non-mutating reconnect surface on the existing controller.**
Add `reconnect: get('/reconnect')` to `createController(routes.admin.supportAgent, ...)`, parallel to the agent-events controller. It reads the admin's indexed gate, verifies the run is still pending (a small run-status resolver, mirroring the `runStatusResolver` seam the agent-events controller injects for tests), clears stale indexes, and returns `context.json({ status: 'none' })` or the gate payload. It must never resume the run and must reject unauthenticated/admin-access via the existing `requireAuth()`/`requireAdmin()` middleware.
- *Alternative considered*: piggyback on the `index` action's initial render. Rejected — `index` renders the page shell; a separate readable endpoint is the agent-events convention and is trivially testable.

**3. Upsert on suspend, clear on terminal, guarded by run id + admin id.**
In the `action` / `toolDecision` / `answer` handlers, on a suspension record the gate (`upsertPendingGate`), and on finish/error/cancel clear it (`clearPendingGate(adminId, runId)`). Guard both by run id so a newer run's row is not clobbered by an older run's terminal hook — the exact guarantee `clearActiveRun` already provides.

**4. Resume resolves from the index.**
`approve`/`decline` and `answer` resolve `runId`/`toolCallId`/`threadId` from the index when not determinable from process memory (e.g. after restart), using `resolvePendingGate(adminId, runId?)`. Return a clean error when no record exists; fail closed.

**5. Structured question card replaces `prompt()` in the chat thread.**
Render the card into `#chat-messages` (the support-agent chat root), not the route agent's `#agent-bar`. Reuse the existing `question` SSE event shape (`question`/`options`/`selectionMode`), add a `gateType` field to distinguish a tool decision from a question for reconnect, and render single/multi select with theme tokens, keyboard reachability (roving-tabindex pattern), and no native prompt.
- *Alternative considered*: adopt `structured-question-ui`'s `#agent-bar` card verbatim. Rejected — it targets the route agent's bar surface; the support agent has a different container.

**6. Structured tool-result rendering via typed output.**
Ensure support tools define `outputSchema` with typed error unions (per `structured-tool-output`), and forward the structured result through the SSE pipeline as a dedicated event the stream renders as a card/table/list (or a downloadable artifact for PDF), rather than only text. Cap rendered rows and offer the full result for large collections.

## Risks / Trade-offs

- **[Behavioral drift during controller edits]** → Keep the handler structure; the existing `app/actions/support-agent/controller.test.ts` is the parity guard. Run it before and after; add cases for the reconnect + resume-from-index paths.
- **[Two pending gates for one admin]** → Single row per admin (`PRIMARY KEY (admin_user_id)`), new run replaces stale; terminal hooks guarded by run id (same as `active-run-store`).
- **[Reconnect surfacing a stale/replayed run]** → Verify the run is still pending via the status resolver before surfacing; clear the record on mismatch and return `none`. Reconnect is idempotent (read + optional clear, never resume).
- **[Structured result payload size / rendering]** → Cap rendered rows in chat; full data available via the artifact/download path; keep text fallback so an unrenderable result degrades to the current behavior.
- **[a11y of the custom card]** → roving-tabindex + ARIA roles; the `lists-keyboard-accessibility` / `a11y-architect` guidance applies.
- **[Drop of `prompt()` is a client BREAKING change]** → Covered by the proposal; the card is the replacement, and tests assert no `prompt()` call path.

## Migration Plan

1. Add the `support_agent_pending_gates` table + index to `db/schema.sql` (idempotent `IF NOT EXISTS`) and a matching idempotent manual migration in `db/manual-migrations/` executed on a dedicated client (see the `ddl-migration-dedicated-client` pattern), incl. a guard against already-existing tables.
2. Ship the store module + controller reconnect + client reconnect-on-load behind the existing admin auth; no route-map change.
3. Rollback: revert the commit and drop the new table; the feature is additive and `reconnect` returning `none` keeps the page idle.

## Open Questions

- Whether the `question` SSE event should carry `gateType` or a new dedicated event is preferred for reconnect — defer the exact wire shape to the apply phase; it does not change the specs' behavior.
- Whether structured tool results render in the chat thread or in the `support-agent-panel` frame — defaulting to the chat thread; can be revisited per result type without changing the specs.
