## Why

The agent-events pipeline's `classify` handler uses substring keyword matching plus a last-token target heuristic. This breaks on anything outside the hardcoded English/German patterns — verb-final German word order misclassified, and the target extractor grabbed the trailing verb as the name. The stopword/stem patch in `classify.ts` only treats the symptom: every new phrasing, inflection, or language needs keyword maintenance. The original design (`2026-07-26-workflowagent2-event-pipeline/design.md`, Decision 4) specified `agent.generate()` for classify; the keyword implementation was a later cost optimization that traded away multilingual generality.

## What Changes

- **`app/actions/agent-events/handlers/classify.ts`** — **BREAKING** Replace the keyword/stopword matching with an LLM classification: on `request.validated`, call `agent.generate()` and parse the returned intent JSON (mirroring `/workflow-agent` Phase 1). Emit `intent.classified` with intent + params, or `intent.unclear` when the agent response cannot be parsed into a known intent.
- **Delete** the `TARGET_STOPWORDS` list, the `message.includes(...)` intent branches, and the `extractTarget()` heuristic — LLM handles target extraction (IDs, emails, names, verb-final order) from full context.
- **Share** the generate-and-parse helper with `/workflow-agent` so intent JSON contract stays consistent between the two routes.
- **Tests** — `controller.test.ts` classify tests change from asserting keyword mapping to asserting the agent-parse path; German verb-final cases become agent-parse assertions (mocked agent), no longer rule-based.
- **Reverses** the `2026-07-27-wire-agent-events-execution` rationale ("no LLM dependency for common intents") — every request now pays one LLM call for classification.

## Capabilities

### New Capabilities
- `agent-events-intent-classification`: How the agent-events pipeline resolves free-text admin requests into structured intents — via LLM generation (not rule-based keyword matching), including target extraction and the unclear-intent fallback.

### Modified Capabilities
- *(none — `admin-agent-routes` covers only routing/chrome, unchanged)*

## Impact

- **`app/actions/agent-events/handlers/classify.ts`**: rewritten from ~190 lines of keyword logic to an agent-call handler.
- **`app/actions/agent-events/controller.test.ts`**: classify tests updated; existing non-classify pipeline tests unaffected.
- **Shared helper**: new module (e.g. `app/actions/mastra/intent-classifier.ts`) used by both `workflow-agent/controller.tsx` and the classify handler, or refactor of the existing generate/parse path.
- **Dependencies**: no new npm dependencies — reuses `mastra.getAgent('workflowAgent')` and `AGENT_TIMEOUT_MS` from `shared-agent.ts`.
- **Cost/latency**: every `/admin/workflowagent2` request now incurs one LLM call for classification.
