## 1. Durable run ownership groundwork

- [x] 1.1 Add a `chat_runs` table to `app/data/schema.ts` (`runId` PK, `userId`, `threadId`, `createdAt`) and apply it via a DDL migration on a dedicated client; verify the table exists after `npm run` migration and `npm run typecheck` passes.
- [x] 1.2 Add an ownership data-access module (record a run, claim a run by `runId` → `userId`, delete on terminal) with unit tests; verify the module's tests pass and it writes/reads/forwards correctly.
- [x] 1.3 Spike-check that no existing mechanism (Mastra `PostgresStoreVNext` run rows, an existing app table) can serve as the run→owner mapping; record the outcome in the module's docstring and confirm the chosen table approach stands.

## 2. Streaming transport in the controller

- [x] 2.1 Rewrite `action` to pipe the agent `fullStream` through `app/utils/agent-sse.ts` (`sseHeaders`, `sseEvent`, `pipeStream`, `filterAndForward`) into the POST response body, and record the `chat_runs` row (`output.runId`, `user.id`, `threadId`); verify the response is `text/event-stream` and emits `start`, `message` deltas, and `complete`.
- [x] 2.2 Remove the `stream` action, `drainAndRebuild`, and all `setStream`/`getStream`/`verifyStreamOwner` usage; remove `routes.chat.stream` (`get('/stream/:runId')`) from `app/routes.ts`; verify `npm run typecheck` and that no reference to `stream-store.ts` remains.
- [x] 2.3 Change `approve`/`decline`/`answer` to gate on the durable ownership module (claim by `runId` → compare `userId`) and delete the row on terminal resolution; verify unit tests show owner-accept and cross-user-reject (403) and that a run survives a simulated restart.

## 3. CSRF agent-path adoption

- [x] 3.1 Add `/chat` and `/chat/*` to `AGENT_PATHS` in `app/middleware/skip-csrf.ts`; verify non-GET requests without `X-Sse-Request: 1` return 403, requests with the header pass through, and GET passes (read-only).
- [x] 3.2 Remove the hidden `#chat-csrf-token`/`_csrf` field from `customer-chat-page.tsx` and its client; verify no `_csrf` reference remains in the chat client/controller.

## 4. Client transport

- [x] 4.1 Rewrite `customer-chat-stream.tsx` to `fetch('/chat', { method:'POST', body })` plus `res.body.getReader()` SSE parsing; keep the `message`, `suspension`, `question`, `tool-*`, `reasoning-*`, `step-finish`, `complete`, `agent-error`, `stream-error` handling; verify a reply renders deltas and ends on `complete`.
- [x] 4.2 Use `X-Sse-Request: 1` on every non-GET fetch (message, approve, decline, answer) and drop the `EventSource`/`/stream/:runId` path; verify the same via integration test.
- [x] 4.3 Decompose the client monolith into a shared SSE reader, the slot-picker widget, and the approval/question card modules; verify the slot picker still books an appointment end-to-end.

## 5. Session-scoped history

- [x] 5.1 Make `index` render an empty conversation area (drop `recallChatMessages` and the `messages`/`threadId`/PRG `error` props), with the client sending `currentThreadId` on each POST; verify a fresh `/chat` load is empty and a second turn continues the same Mastra thread (memory still persists).

## 6. Tests and integration verification

- [x] 6.1 Update `app/actions/chat/controller.test.ts` for the new transport and add streaming + cross-user ownership tests; verify `npm test` passes for the chat suite.
- [x] 6.2 Run `npm run typecheck` and `npm run lint`; verify no new errors.
- [x] 6.3 Verify the admin chatlog view still shows conversation history from Mastra memory/DB (not the removed `/chat` GET replay); manual smoke: book an appointment via the slot picker and approve a tool suspension.
