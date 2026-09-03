## Context

See proposal.md — Why. Current state that shapes the approach:

- `createModel()` in `app/actions/mastra/agent-config.ts` returns an inline `OpenAICompatibleConfig` (`providerId: 'opencode-go'`, `modelId: 'deepseek-v4-flash'`, `url: OPENCODE_API_URL`, lazy `get apiKey()`), shared by the support, customer, and workflow agents.
- Mastra's request to `opencode.ai/zen/go/v1` already carries `User-Agent: mastra/1.63.2` plus `x-thread-id`/`x-resource-id` memory headers, but **no `x-opencode-session`**.
- Verified end-to-end that a static `headers` on the inline config reaches the wire: `OpenAICompatibleConfig.headers` → `mergeHeaders(this.config.headers, auth.headers)` → AI SDK `combineHeaders(config.headers(), options.headers)`.
- The three consumers are not uniform: two are `Agent` paths (`agent.stream` in `support-agent/controller.tsx` and `chat/controller.tsx`, both with `threadId` in scope), one is a **Workflow** path (`run.stream` in `agent-events/controller.tsx`) whose per-run header mechanism is not the same as the Agent `requestContext` flow.
- Deadline: 2026-09-05/06 (2–3 days).

## Goals / Non-Goals

**Goals:**

- Every Mastra inference request to `opencode.ai/zen/go/v1` carries a stable `x-opencode-session` header before the deadline.
- One change in `createModel()` covers all three surfaces (support, customer, workflow).
- The session id is stable across server restarts.

**Non-Goals:**

- Per-conversation (thread-scoped) session ids — deferred, see Decision 1.
- Fixing Hermes on the VPS (out-of-repo ops: update to latest release, hermes-agent#101864).
- Driving the upstream AI SDK fix (vercel/ai#20271).

## Decisions

### Decision 1: Static per-deployment session id (shipped) over per-thread (follow-up)

**Chosen:** a single static `x-opencode-session` value set in `createModel()`.

Rationale:

- The deadline is 2–3 days out; a static header in the shared model config is a one-file change that covers all three surfaces at once, including the Workflow path where per-run headers are not uniformly plumbed.
- The service's enforcement is header-presence based ("requests without an `x-opencode-session` header will error"); a stable deployment UUID satisfies it.

**Alternative considered — per-thread id via `ModelWithRetries.headers`:** verified feasible for the two `Agent` paths — `prepareModels` resolves the `headers` DynamicArgument per run against `requestContext`, and `mergeLlmCallHeaders` merges the result into the LLM call. It would also unlock session-aware caching (Zen cached reads ≈ 3% of input price for DeepSeek V4 Flash). Rejected for the initial ship because it requires (a) switching `createModel()` to the `ModelWithRetries[]` array shape, (b) plumbing `requestContext: { sessionId: threadId }` at both `agent.stream` call sites, and (c) verifying the Workflow `run.stream` path separately — three moving parts against a hard deadline. Recorded as the follow-up optimization.

### Decision 2: Id source = `OPENCODE_SESSION_ID` env var with file-backed fallback

- Read `process.env.OPENCODE_SESSION_ID`; document it in `.env.example`.
- If unset, generate a UUID once and persist it to a stable location (e.g., a data file under the project) so it survives restarts, logging a warning that it was auto-generated.

Alternatives rejected:

- Bare `crypto.randomUUID()` at module load — regenerates on every restart, defeating "stable".
- Reusing `SESSION_SECRET` — not a UUID and semantically unrelated.

### Decision 3: Set the header on the inline config, not per-call

`OpenAICompatibleConfig.headers` is the supported static field and is verified to reach the wire (see Context). No per-call option plumbing needed.

## Risks / Trade-offs

- **[Static id is shared across all conversations]** → The service asked for a "stable per-conversation ID"; a deployment-level UUID is stable but coarse. Mitigation: enforcement is presence-based, and prompt caching on shared prefixes (e.g., system prompts) is still correct and beneficial. Revisit per-thread if the service tightens semantics.
- **[Auto-generated id persistence file may be unwritable]** → On read-only filesystems (serverless, some containers) the file write fails. Mitigation: fall back to an in-memory random id with a warning; in production require `OPENCODE_SESSION_ID` explicitly.
- **[Mastra upgrades could change header plumbing]** → `headers` is part of the public inline-config type, so drift risk is low; re-verify on major Mastra upgrades.

## Migration Plan

1. Add `headers: { 'x-opencode-session': <resolved id> }` to `createModel()` in `app/actions/mastra/agent-config.ts`.
2. Add `OPENCODE_SESSION_ID` to `.env.example` (optional, commented) and set it in `.env`.
3. Smoke-test one agent call (support or customer chat) to confirm the header is sent and the response is not a 4xx.
4. Rollback: remove the `headers` line — one-line revert, no data migration.

## Open Questions

None — the workflow-path header application is a smoke-test verification step (Migration Plan step 3), not a design unknown.