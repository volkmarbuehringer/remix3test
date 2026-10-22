---
name: mastra-deltas
description: "Use when building or debugging Mastra in this Remix app — inline agent model config, single-POST SSE streaming/pipeStream and pipe-stream write races, askUserTool/requireToolApproval suspension (restoring a pending gate after reload, durable run ownership, awaiting the durable write before the SSE body closes), tool-result and message-content handling, PostgresStore-backed observability, storage API vs raw SQL, a shared ReadableStream consumed before you stored it, parsing agent.generate() JSON output safely, memory-thread materialization before streaming, tool design and approval gating (requireApproval + generate(), suspension detection, sequential approval chaining, parameter self-lookup, RequestContext actor, offset pagination), Workflow SSE resume/abort races with server-side state, strict step schema types in .parallel()/.then(), reader-cancel reconnect recovery, plain-object failed-run result.error, and a Mastra agent navigating Remix 3 Frames, prefilling forms from conversation context, or submitting forms via JSON."
user-invocable: false
origin: consolidated
---

# Mastra Deltas: Agent, Tools, Workflow & Remix Routing

Consolidated from 4 former learned skills (`mastra-agent`, `mastra-tools`, `mastra-workflow`, `remix3-agent-routing`) on 2026-10-17. Reference files are namespaced under `references/<former-skill>/`. Everything vendor-supplied (guides, package READMEs, the vendor `remix` / `mastra` skills) stays authoritative — sections below are deltas only.

## Load Only The Sections You Need

| You need... | Section | References |
| --- | --- | --- |
| Building/debugging Mastra agents — model config, SSE pipeStream + write races, suspension/HITL durable-run ownership, tool results, observability store, thread materialization | § Agent | `references/mastra-agent/` |
| Designing/hard-gating agent tools — requireApproval + generate(), suspension detection, approval chaining, RequestContext actor, pagination | § Tools | `references/mastra-tools/` |
| Debugging Mastra Workflow — SSE resume/abort race, step schema types, reconnect recovery, failed-run result.error | § Workflow | `references/mastra-workflow/` |
| Mastra agent navigating Remix Frames — agent → SSE navigate → frame → form → JSON pipeline, prefill from conversation context | § Agent Routing | `references/remix3-agent-routing/` |

## Agent

_(formerly `mastra-agent` — references live under `references/mastra-agent/`)_

**Consolidated from:** `mastra-agent-inline-model-config`, `mastra-agent-streaming-sse`, `mastra-agent-toolresult-chunk-format`, `mastra-message-content-normalization`, `mastra-observability-postgres-store`, `mastra-storage-api-vs-raw-sql`, `mastra-agent-pending-gate-restore`, `mastra-durable-run-ownership`, `drain-and-rebuild-stream-race`, `llm-classification-json-parsing`, `mastra-sse-pipestream-write-race`

This skill is the **index** for Mastra agent deltas. For the framework API, use the vendor `mastra` skill (`.opencode/skills/mastra/SKILL.md`) and its `references/`.

### Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| Constructing an `Agent` without eager model resolution; registering lazily with `mastra.addAgent()`; `createDurableAgent()` crashing app startup | `references/mastra-agent/model-config.md` |
| Streaming `agent.stream()` over SSE in one POST; `pipeStream`; SSE event types; client/server event-contract drift; consolidating hand-rolled client readers onto a shared `readEventStream` and preserving post-loop cleanup on early stop; `askUserTool` question/resume; `requireToolApproval` snapshot loss | `references/mastra-agent/sse-streaming.md` |
| Extracting tool output from `agent.generate()` when the shape is chunk vs flat, or when `toolName` is the property key | `references/mastra-agent/tool-results.md` |
| Normalizing the polymorphic `content` (string / v2 parts / `.text` / array) to plain text | `references/mastra-agent/message-content.md` |
| Adding observability to a PostgresStore-backed Mastra without DuckDB or LibSQL | `references/mastra-agent/observability-postgres-store.md` |
| Redacting PII, sampling spans, or sizing high-volume trace storage | `references/mastra-agent/observability-postgres-store.md` |
| Deleting a library-managed storage row, or tempted to `DELETE FROM mastra_*` directly | `references/mastra-agent/storage-api-vs-raw-sql.md` |
| A suspended `ask_user`/approval card is missing after reload and the user must retype | `references/mastra-agent/pending-gate-restore.md` |
| Approve/decline/answer returns 403 after restart/scale or on a re-suspended run | `references/mastra-agent/durable-run-ownership.md` |
| A library internally consumes a `ReadableStream` getter before you store it, and the stored stream yields ~2 bytes/empty | `references/mastra-agent/drain-and-rebuild-stream-race.md` |
| A `pipeStream` suspension/terminal hook fire-and-forgets a durable write, so the body closes and a follow-up read/reconnect sees stale state | `references/mastra-agent/sse-pipestream-write-race.md` |
| A new conversation's first turn fails with `No thread found with id <id>`; a memory-reading input processor (`ToolSearchProcessor` with `storage: 'context'`) recalls a thread Mastra has not lazily created yet | `references/mastra-agent/materialize-thread-before-stream.md` |
| Parsing `agent.generate()` JSON for intent/classification — numeric `targetQuery`, markdown-wrapped/noisy output, or a required safe fallback | `references/mastra-agent/llm-classification-json-parsing.md` |
| Adding `runEvals` gates over the app agents; a gate target, tool name, or runner script that will not work | `references/mastra-agent/evals-gates.md` |
| Using `Classifier`/`ClassifierProcessor` with a custom provider; typed intent vs free-text extraction; a guardrail turn that returns an empty reply | `references/mastra-agent/evaluation-model-classifier.md` |

### Core Rules

- Prefer the **inline model config object** over `model: getModel()` so a missing API key fails only the AI route, not module load / app startup.
- **Wrap with `createDurableAgent()` lazily.** The durable wrapper's constructor calls `agent.getModel()` even when the wrapped agent uses the inline config, so wrapping at module load re-introduces the startup crash. Create it (and `mastra.addAgent(...)`) on first use.
- Stream with a **single POST**: call `agent.stream()` inside the action's `ReadableStream.start`, emit a `start` event, then pipe `fullStream` into the same response. No in-memory stream-store, no second endpoint.
- Treat `agent.generate()` tool output as **chunk-or-flat** and iterate `toolResults` directly; `toolName` at runtime is the JavaScript property key, not the `createTool({ id })` value.
- Normalize message `content` at the memory boundary with a shared `messageContentToText()` so every consumer gets `content: string`.
- **PostgresStore already composes observability** (all domain classes, including `ObservabilityPG`; `init()` creates the tables). The Studio `MastraCompositeStore` + `LibSQLStore` + `DuckDBStore` wiring is unnecessary on Postgres — install `@mastra/observability` and wire `Observability` + `MastraStorageExporter` into the existing `Mastra()`.
- **No sampling by default** (100% of spans persisted); `SensitiveDataFilter` redacts only by key name, not free-form PII. Past roughly 1,500 spans/sec, move observability to DuckDB/ClickHouse.
- **Use the storage API, not raw SQL**, when the API has side effects: `memory.deleteThread(id)` handles all cleanup. Raw `DELETE FROM mastra_*` couples to private schema, is non-atomic, orphans vector embeddings, and skips future cleanup. If unavoidable, wrap in a transaction and document the coupling.
- **A suspended gate must be restorable**: the card is live-SSE-only, so persist a per-actor gate payload and expose a `reconnect` endpoint the client calls on mount — joining the ownership table and filtering `status = 'suspended'` so a settled run is never surfaced. Reuse one `gateHooks(...)` helper across the initial/tool-decision/answer streams.
- **Ownership must be durable**: persist a `run_id` to `user_id` pointer for the 403 gate (do not reuse the admin-only `admin_active_runs`). Record on start **and** every continuation, and clear the incoming run only when a **distinct** continuation run was created — a stale row is cheaper than a false 403. Insert idempotently (`ON CONFLICT (run_id) DO NOTHING`); add the table to both `db/schema.sql` and the `remix/data-table` DSL.
- **Materialize a thread before streaming when an input processor reads memory.** Mastra creates the thread lazily while saving the first message, but `ToolSearchProcessor({ storage: 'context' })` recalls it during prepare-tools; `Memory.recall` rejects a missing thread when given a `resourceId`. Call `memory.createThread({ threadId, resourceId })` first (guarded by `getThreadById` so `createdAt` is not rewritten) — see `references/mastra-agent/materialize-thread-before-stream.md`.
- **The conversational agent layer is shared, not per-surface**: `app/utils/agent-chat.ts` (`createAgentChat`) owns the `messageStream`/`toolDecision`/`answer`/`reconnect` lifecycle plus the gate hooks and settle/clear rules; `app/utils/agent-gate-store.ts` (`createGateStore({ table, ownerColumn, markMode, resolve })`) owns the durable pointer SQL. `app/actions/{chat,support-agent}/controller.tsx` are thin route bindings plus that surface's policy (actor scope, frame target, run-ownership recorder/authorizer, rate limits, audit). Add per-surface behavior as a config hook — never copy the stream/gate logic back into a controller. The per-surface test seams (`__setTestAgent`, `__setTestThreadResolver`, `__setRunStatusResolver`) stay in the thin controller and are passed in via config, so `resolveAgent` must still be the single resolver each surface routes through.
- **App agents are built through `defineAppAgent(...)`** (`app/actions/mastra/agent-config.ts`), which installs the model, `defaultOptions.modelSettings`, the working-memory default and `ask_user`, so agent files declare only content. Constrain its tools generic to Mastra's `ToolsInput`, **not** `Record<string, unknown>` — the latter's value type is `unknown` and fails `ToolsInput` assignability with `TS2322` ("`string` index signatures are incompatible").
- **A headless LLM helper is a utility, not a registered agent**: the workflow intent classifier lives in `app/actions/mastra/workflow-classifier.ts` (`generateWorkflowIntent`) and constructs an **unregistered** `Agent` used only as the LLM-call primitive (no `defineAppAgent`, no `ask_user`, no UI). `Mastra.agents` holds only the conversational app agents (`supportAgent`, `customerAgent`); resolve the classifier through `resolveWorkflowAgent()` in `intent-classifier.ts`, which both the Agent-Events classify handler and the support agent's `classify_intent` tool share.
- **Demoting a registered agent to a utility keeps the seam but changes two hidden things**: keep `resolveWorkflowAgent()` / `__setWorkflowAgent()` and delete only the agent file + registry entry, so both consumers and their tests are untouched. Two consequences are silent: an unregistered `Agent` emits **no Mastra observability spans**, and swapping the dynamic `await import('./index.ts')` registry lookup for a static utility import pulls the utility's transitive imports (e.g. `storage.ts`, which throws without `DATABASE_URL`) into the import graph at module load.
- **Consolidating a multi-agent registry: separate personas from headless helpers.** Inventory each agent by surface, tool set, mutation capability, and consumers. A headless JSON classifier is a utility, not a persona. Never merge conversational agents that differ in trust domain (read-only admin vs. customer mutation) or input processors (PII/cost guards).
- **A `Classifier` returns choice/score/boolean, or a `RefusalAnswer`** — it cannot extract free text, so pair it with a structured-output agent rather than replacing one. Since Mastra 1.79 a refusal leaves `choice`/`score`/`probability` undefined; handle the missing value and fail open (or map to the app's safe default) on a refusal. The app's `blocksMutation` accepts `string | undefined` so the gate needs no `type` check. Prefer `classifier.decide()` and a `doDecide` adapter (`evaluate`/`doEvaluate` are deprecated, but the interface still requires the legacy alias). A `ClassifierProcessor` abort is a `tripwire` chunk, not `error`; map it to a visible event **and** `complete`. Set an explicit agent-level `maxProcessorRetries` when configuring `errorProcessors` (default backstop 3 = up to 4 model calls/turn).

**Drain-and-rebuild a raced stream (`references/mastra-agent/drain-and-rebuild-stream-race.md`)**

- When a library's `fullStream` getter wraps a shared base stream and its internal broadcast races your `setStream`, the loser gets an empty (~2-byte) stream. Drain the stream into an array synchronously (before the library's microtask) and rebuild a fresh `ReadableStream`; or use `tee()` where supported. Trades streaming latency for deterministic delivery.

**Await the durable write before the SSE body closes (`references/mastra-agent/sse-pipestream-write-race.md`)**

- `pipeStream`'s settle path calls `closeOnce()`, which can end the response before a fire-and-forget hook write commits; a read right after the stream, or a reconnect, then sees the pre-write state (`running` instead of `suspended`) — timing-dependent and easy to misread as a data bug. Return the write promise from the suspension/terminal hook and have the stream-settle path **await it before closing**; the test must fully consume the response body (`await parseSSEResponse(response)`) before reading the durable row.

**Parse LLM classification JSON (`references/mastra-agent/llm-classification-json-parsing.md`)**

- Tolerantly extract the first `{` … last `}` (strip markdown/prose), coerce ID-like fields from `string | number` with `String(raw).trim()` instead of asserting `typeof === 'string'`, bound the call with `abortSignal: AbortSignal.timeout(ms)` (treat `TimeoutError` as control flow, not a fault), and return a discriminated `{ unclear }` fallback so garbage can never execute an action.

### Related Skills

- `mastra-deltas § Tools` — approval gating, suspension detection, tool design patterns
- `mastra-deltas § Workflow` — Workflow resume/abort race and step type compatibility
- `mastra-deltas § Agent Routing` — agent-driven frame navigation and form prefill using the `navigate` event
- `remix3-server § Security` (`references/security-gotchas/security-middleware.md`) — CSRF bypass for SSE endpoints
- `dev-gotchas § Rate Limiter` — rate limiter configuration for multi-step agent flows

---

## Tools

_(formerly `mastra-tools` — references live under `references/mastra-tools/`)_

**Consolidated from:** `mastra-tool-approval-generate`, `mastra-tool-suspension-detection`, `mastra-tool-offset-pagination`, `mastra-tool-param-self-lookup`, `mastra-tool-single-job-separation`

This skill is the **index** for tool-design deltas. For the base approval API (`requireApproval`, `finishReason: 'suspended'`, `approveToolCallGenerate`/`declineToolCallGenerate`, `requireToolApproval`), use the authoritative `node_modules/@mastra/core/dist/docs/references/docs-agents-human-in-the-loop.md`.

### Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| Hard-gating a destructive tool with `agent.generate()`; the detached-`this` trap; sequential multiple-`requireApproval` chaining; inferring which tool suspended from the payload | `references/mastra-tools/approval-gating.md` |
| Designing tools: one job per tool, internal parameter self-lookup instead of asking the LLM, offset pagination for "show more" | `references/mastra-tools/tool-design.md` |
| Reading the current user/admin id in `execute`; `RequestContext` vs old `AsyncLocalStorage`; `TS2322` on a typed context | `references/mastra-tools/actor-request-context.md` |

### Core Rules

- Call `agent.approveToolCallGenerate(...)` / `declineToolCallGenerate(...)` directly on the agent (or `.call(agent, ...)`) — extracting the method drops `this` and crashes in `resumeGenerate`.
- `approveToolCallGenerate` returns a `FullOutput` with **no** `runId`/`fullStream`; emit a `start` SSE event with the known `runId` first or the client's `currentRunId` stays null and later decisions silently no-op.
- A `requireApproval` suspension payload has `toolCallId`/`toolName`/`args` (not `question`); `askUserTool` has `question`. Branch on the payload shape.
- Look up session/context parameters (admin id/email, IP, tenant, timestamp) inside `execute` from the second `{ requestContext }` argument, not in the input schema — otherwise the LLM asks the user, confabulates, or skips the tool.
- Give each phase its own single-job tool (lookup → navigate → ask_user → execute) rather than a `confirmed` state flag.

### Related Skills

- `mastra-deltas § Agent` — SSE streaming, askUserTool/requireApproval transport, tool result extraction
- `mastra-deltas § Workflow` — Mastra Workflow resume/abort race and step type compatibility
- `remix3-server § Security` (`references/security-gotchas/security-middleware.md`) — CSRF protection for approval form endpoints
- `remix3-ui § Frames` (`references/remix3-frame-cliententry/session-flash-frames.md`) — `session.flash()` for one-time approval UI routing decisions

---

## Workflow

_(formerly `mastra-workflow` — references live under `references/mastra-workflow/`)_

**Consolidated from:** `mastra-workflow-resume-abort-race`, `mastra-workflow-step-type-compatibility`

This skill is the **index** for Mastra Workflow deltas. For the streaming transport, see `mastra-deltas § Agent`; for confirmation-gate tools, see `mastra-deltas § Tools`.

### Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| Client aborts the SSE stream then resumes a suspended workflow; server-side Map/cache cleanup races the resume | `references/mastra-workflow/resume-abort-race.md` |
| TS errors about `inputSchema` compatibility in `.parallel()` or output/input mismatch across `.then()` chains | `references/mastra-workflow/step-schema-types.md` |
| Reconnect/re-attach after a reader cancel (run stays `running`, snapshot `suspended`), or `[object Object]` from a failed run's `result.error` | `references/mastra-workflow/reconnect-and-error-mapping.md` |

### Core Rules

- Do not rely on server-side state that is cleaned up on request abort — pass the `workflowId` through the SSE `start` event and send it back on resume.
- All `.parallel()` steps must accept the workflow's `inputSchema`; each `.then()` step's input must match the previous step's output. Compose at the executor level when they don't.
- Cancelling the SSE reader does **not** abort the run: a live `running` snapshot is "still in flight", not stale; source the gate payload from the snapshot when the index payload is `NULL`.
- `result.error` on a failed run is a plain serialized object, not an `Error` — map it through `runErrorMessage(error)` at one choke point.

### Related Skills

- `mastra-deltas § Agent` — SSE streaming transport shared with workflow streaming
- `mastra-deltas § Tools` — confirmation-gate tools (`requireApproval`, `ask_user`) that suspend agents and workflows

---

## Agent Routing

_(formerly `remix3-agent-routing` — references live under `references/remix3-agent-routing/`)_

**Consolidated from:** `remix3-agent-driven-frame-navigation`, `remix3-agent-form-prefill`, `agent-aware-form-controller`

This skill is the **index** for the agent-routing pipeline. For the SSE transport that carries `navigate`/`question`/`suspension` events, see `mastra-deltas § Agent`. For the frame/clientEntry mechanics, see `remix3-ui § Frames`.

### Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| An agent `navigate` tool; translating a `tool-result` into a `navigate` SSE event; client frame reload + `history.pushState`; prefilling a form via the `X-Agent-Prefill` header | `references/remix3-agent-routing/navigate-and-prefill.md` |
| An `X-Agent-Thread` JSON branch in a form controller; client frame-form intercept; multi-form chaining; CSRF/rate-limit/path-validation for agent endpoints | `references/remix3-agent-routing/agent-form-controllers.md` |
| Which support-agent panel POST forms may defer to the runtime's `data-rmx-target` interception and which must stay on the client replay | `references/remix3-agent-routing/support-panel-form-targets.md` |

### Core Rules

- The agent's `navigate` tool returns `{ type: 'route', path }`; the SSE forwarder maps it to a `navigate` event carrying `href`, `target`, `history`, and optional `prefill`.
- Validate the path on **both** sides (tool `execute` and client before `frame.src = href`) — prompt injection must not reach arbitrary URLs.
- Prefill travels client store → `X-Agent-Prefill` base64 header → `readAgentPrefill()`; delete the store entry only after `response.ok`, and use `TextEncoder`/`Buffer.from` for UTF-8 safety.
- Form controllers gain an agent branch when the `X-Agent-Thread` header is present, returning JSON instead of HTML; the client intercepts the submit and posts the JSON to the agent's answer endpoint.
- Do **not** reload the frame after the JSON response (it races the agent's next navigate); let the agent navigate.

### Related Skills

- `mastra-deltas § Agent` — the SSE transport that carries `navigate` and `question` events
- `remix3-forms § Validation Errors` — validation errors re-render inline and preserve user edits over prefill values
- `remix3-server § Security` (`references/security-gotchas/security-middleware.md`) — CSRF configuration for agent endpoints
- `dev-gotchas § Rate Limiter` — rate limiter settings for multi-step agent flows
