## 1. Shared intent-classifier module

- [x] 1.1 Create `app/actions/mastra/intent-classifier.ts` with `parseIntentJson(text)` — tolerant JSON extraction (brace-scan + parse, mirroring `/workflow-agent` `extractJson`)
- [x] 1.2 Add `classifyWithAgent(message)` — calls the injected `workflowAgent.generate` with `AbortSignal.timeout(AGENT_TIMEOUT_MS)`, parses via `parseIntentJson`, maps agent output to pipeline intents
- [x] 1.3 Implement the agent-JSON → pipeline-intent mapping table (user-action cancel/lock/unlock → cancel-user/lock-user/unlock-user; appointment check → show-appointments; unmapped/unparseable → unclear)

## 2. Rewrite classify handler

- [x] 2.1 Rewrite `app/actions/agent-events/handlers/classify.ts` to use the injectable agent getter + `classifyWithAgent` on `request.validated`
- [x] 2.2 Emit `intent.classified` with `intent` + `params.targetQuery` on successful mapping, or `intent.unclear` on timeout/unparseable/unmapped
- [x] 2.3 Delete the `TARGET_STOPWORDS` list, the `message.includes(...)` intent branches, and `extractTarget()`

## 3. Test injection + test updates

- [x] 3.1 Add a module-level mutable agent reference with a setter in `classify.ts` (defaulting to `mastra.getAgent('workflowAgent')`) so tests can inject a fake `generate`
- [x] 3.2 Update `controller.test.ts` classify tests to inject the fake agent: German verb-final (`ich will john doe sperren` → lock-user / `john doe`; `ich will max mustermann kündigen` → cancel-user / `max mustermann`), English (`cancel user 42` → cancel-user / `42`), email targets, and unparseable-response → `intent.unclear`
- [x] 3.3 Add a timeout/abort test asserting `intent.unclear` when the fake agent rejects after abort

## 4. Verify

- [x] 4.1 Run `npm test` — all agent-events tests pass
- [x] 4.2 Run `npm run typecheck` and lint
