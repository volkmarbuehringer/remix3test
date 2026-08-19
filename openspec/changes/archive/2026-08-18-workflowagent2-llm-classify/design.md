## Context

See `proposal.md` — Why. Current state: `classify.ts` resolves intents with substring keyword matching and a stopword-list target extractor; it emits `intent.classified` or `intent.unclear`. The pipeline's `intent.classified` event carries `intent` (one of `cancel-user`, `lock-user`, `unlock-user`, `show-appointments` per `intents.ts`) plus `params.targetQuery`. The shared `workflowAgent` Mastra agent (`app/actions/mastra/agents/workflow-agent.ts`) already resolves the same domain from free text — it returns `{type, action, targetQuery}` JSON and already encodes the German verb → English action mapping (`kündigen→cancel`, `sperren→lock`, `entsperren→unlock`, etc.). `/workflow-agent/controller.tsx:191` calls `agent.generate(message)` and parses via `JSON.parse`/`extractJson` (`controller.tsx:523`).

## Goals / Non-Goals

**Goals:**

- Classify every `request.validated` event through the LLM, not keyword rules.
- Reuse the existing `workflowAgent` agent so the German verb mapping and target extraction live in one place (the agent prompt), consistent with `/workflow-agent`.
- Keep the event contract (`intent.classified` / `intent.unclear`) and downstream handlers (`resolve`, `dispatch`, `execute`) untouched.
- Make the handler testable without a live LLM (injectable agent).

**Non-Goals:**

- No changes to `/workflow-agent` controller behavior (its richer memory/thread flow stays as-is; only the parse helper is shared).
- No new intents beyond the four the pipeline executes.
- No keyword/rule fallback layer — classify is LLM-only.

## Decisions

### Decision 1: Reuse `workflowAgent`, don't create a dedicated agent
The classify handler calls `mastra.getAgent('workflowAgent')` and `generate(message)` with `AbortSignal.timeout(AGENT_TIMEOUT_MS)`, mirroring `/workflow-agent`. The agent's prompt already handles German verb-final order and target extraction, which is the exact gap the keyword implementation failed on.

**Alternatives considered:** a dedicated `agentEvents` agent with a slimmer prompt (more isolation, but duplicates the verb mapping and needs a second model config + storage); keyword fast-path + LLM fallback (option 2 — keeps cost down but preserves the mis-hit blind spots, rejected by choice of option 3).

### Decision 2: Shared generate-and-parse helper in `app/actions/mastra/intent-classifier.ts`
New module exposing:

- `classifyWithAgent(message): Promise<{ intent: string; targetQuery: string } | { unclear: string }>` — calls `generate`, parses JSON, maps agent output to pipeline intents.
- `parseIntentJson(text): { type; action; targetQuery } | null` — the `extractJson`-style tolerant parse (`/workflow-agent/controller.tsx:523`).

Agent JSON → pipeline intent mapping:

```
{ type:'user-action', action:'cancel'   } → cancel-user
{ type:'user-action', action:'lock'     } → lock-user
{ type:'user-action', action:'unlock'   } → unlock-user
{ type:'appointment', action:'check'    } → show-appointments
anything else / unparseable             → intent.unclear
```

Actionable intents (cancel/lock/unlock) additionally require a non-empty `targetQuery`; a missing/empty target degrades to `intent.unclear`. `appointment:check` may have an empty target (general "show all appointments" query). Numeric `targetQuery` values from the model are coerced to strings.

`/workflow-agent` continues to use its own inline generate+parse for now; the new helper becomes the single canonical parse (and the controller may adopt `parseIntentJson` in a follow-up).

### Decision 3: Injectable agent getter for tests
The handler gets the agent through a module-level mutable reference (setter pattern — see learned skill `mutable-executor-setter-testable-imports`), defaulting to `mastra.getAgent('workflowAgent')`. Tests inject a fake `generate` returning canned JSON so the German cases (`ich will john doe sperren` → `lock-user` / `john doe`) assert the parse+mapping path without a live LLM.

**Alternatives considered:** instantiating a real Mastra agent in tests (needs API key/network — rejected); accepting the agent as a constructor arg (handlers are module constants, no DI container — rejected).

### Decision 4: Keep the handler stateless — no memory thread
Unlike `/workflow-agent` (conversational, memory + thread), the event pipeline classifies one request per run and stores resume state in `controller.tsx`'s `pendingConfirmMap`. `generate(message)` without a `memory` option is sufficient.

### Decision 5: Timeout failure surfaces as `intent.unclear`
`AbortSignal.timeout(AGENT_TIMEOUT_MS)` aborts the call; a caught timeout/error emits `intent.unclear` with a short message. Downstream `controller.tsx` already handles `intent.unclear` by streaming the message and closing (`controller.tsx:77-81`). No new event type.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Every request now pays LLM cost/latency (reverses 2026-07-27 rationale) | Accepted trade-off for multilingual correctness; timeout bounds worst case |
| Agent JSON drifts from expected `{type, action, targetQuery}` shape | `parseIntentJson` tolerant parse; unmapped shapes fall to `intent.unclear` (safe: no action runs) |
| Reusing `workflowAgent` couples classify to its prompt (includes appointment/delete-resource actions the pipeline doesn't execute) | Mapping in Decision 2 rejects those actions → `intent.unclear` instead of mis-executing; keeps German verb map DRY |
| Slow agent stalls pipeline | `AGENT_TIMEOUT_MS` (60s) abort → `intent.unclear` |

## Migration Plan

1. Add `app/actions/mastra/intent-classifier.ts` with `parseIntentJson` + `classifyWithAgent`.
2. Rewrite `classify.ts` handler: injectable agent, `classifyWithAgent` on `request.validated`, emit `intent.classified` (with `targetQuery`) or `intent.unclear`.
3. Delete keyword/stopword logic and `extractTarget()`.
4. Update `controller.test.ts` classify tests to inject a fake agent; keep German verb-final cases as assertions on the parse+mapping path.
5. Rollback: revert `classify.ts` to the keyword implementation (git history); no schema or event-contract changes.

## Open Questions

- None — agent choice, mapping, timeout, and test injection are settled in the decisions above.
