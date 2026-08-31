## 1. Durable pending-gate store

- [x] 1.1 Add the `support_agent_pending_gates` table + `run_id` index to `db/schema.sql` (`CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`, columns: `admin_user_id` PK → users, `run_id`, `thread_id`, `tool_call_id`, `tool_name`, `args JSONB`, `gate_type`, `suspend_payload JSONB`, `created_at`, `updated_at`) and an idempotent manual migration in `db/manual-migrations/` (run on a dedicated client, guarded with `IF NOT EXISTS`). Verification: `git diff db/schema.sql` shows the table; re-running the migration is a no-op.
- [x] 1.2 Create `app/actions/support-agent/run-store.ts` mirroring `agent-events/active-run-store.ts`: `upsertPendingGate` (one row per admin, replace on new run), `markGateSuspended` (store toolCallId/toolName/args/gateType/suspendPayload), `clearPendingGate(adminUserId, runId)` (run-id guarded), `resolvePendingGate`, and a run-status resolver seam. Verification: `npm run typecheck` passes.
- [x] 1.3 Add `run-store` unit tests for upsert-replace, suspended-payload write, run-id-guarded clear, and resolve-not-found. Verification: `npm test` runs the new cases green.

## 2. Controller reconnect + durable-index wiring

- [x] 2.1 Upsert `running` and call `markGateSuspended` on suspension in the `action` handler; call `clearPendingGate` on finish/error/cancel. Verification: the existing support-agent tests still pass (`npm test`), plus a new assertion that a suspend writes the index.
- [x] 2.2 Add `reconnect: get('/reconnect')` to `createController(routes.admin.supportAgent, ...)`: read the admin's pending gate, verify the run is still pending via the resolver seam, clear stale rows and return `context.json({ status: 'none' })`, else return the gate payload. Verification: `npm run typecheck` + a controller test covering the `none` and payload paths, and non-mutating/unauthenticated behavior.
- [x] 2.3 Wire `reconnect` into `app/routes.ts` under `routes.admin.supportAgent` (parallel to agent-events) and confirm the route map resolves. Verification: `npm run typecheck` and `app/router.ts` still maps `supportAgent` without change.

## 3. Resume resolves from the index

- [x] 3.1 In `toolDecision` (approve/decline) and `answer`, resolve `runId`/`toolCallId`/`threadId` from `resolvePendingGate` when not determinable from memory; fail closed with an error response when no record exists. Verification: new test cases for resume-from-index and missing-index error; `npm test` green.
- [x] 3.2 Ensure approve/decline/answer clear the index on terminal completion and keep the existing audit logging. Verification: existing approval-flow tests still pass; a new test asserts the index is cleared after resume.

## 4. Client reconnect-on-load + structured question card

- [x] 4.1 In `support-agent-stream.tsx`, on load call the `reconnect` surface; when a gate payload is returned, re-render it and bind approve/decline/answer to the resolved run id. Verification: browser/e2e test reloads the page with a pending gate and reselects/resumes; no `window.prompt()`.
- [x] 4.2 Replace the single-select `window.prompt()` fallback in `showQuestion` with a rendered question card in `#chat-messages` supporting single- and multi-select, themed via `theme`, with keyboard-accessible options/confirm (roving-tabindex). Verification: unit/a11y test asserts the card renders and no `prompt()` path exists; `npm test` green.
- [x] 4.3 Add a `gateType` to the `question`/`suspension` SSE payload so reconnect can distinguish a tool decision from a question, and update the stream's event handling accordingly. Verification: existing stream tests pass with the new field.

## 5. Structured tool-result rendering

- [x] 5.1 Ensure support tools in `app/actions/mastra/tools/support-tools.ts` define `outputSchema` with typed error unions (per `structured-tool-output`) for list, detail, and PDF results. Verification: `npm run typecheck` + a tool test asserting output shapes validate.
- [x] 5.2 Forward structured tool-result data through the SSE pipeline as a dedicated event, and render it in `support-agent-stream.tsx` as a table/list (collections), a detail card (single entity), a downloadable artifact (PDF), or a clear empty state. Verification: a browser/e2e test sends a tool call and asserts structured rendering, with text fallback preserved.

## 6. Integration verification

- [x] 6.1 Run `npm run typecheck` and `npm run format:fix`; resolve formatting drift. Verification: both complete clean.
- [x] 6.2 Run the full support-agent test suite plus the new reconnect/resume/structured-UI cases. Verification: `npm test` green.
- [x] 6.3 Confirm the read-only boundary is intact: an account-mutation request still directs to agent-events and never invokes a mutation tool. Verification: existing spec-driven guardrail test passes.
