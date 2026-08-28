## Context

`/chat` is the public customer chat (`app/actions/chat/controller.tsx` + `app/ui/customer-chat-page.tsx` + `app/assets/streams/public/customer-chat-stream.tsx`), wired to `routes.chat`. It is older than the admin agent chats and sits on a different transport. See `proposal.md` for the full motivation. Relevant current facts:

- `action` calls `agent.stream` and drains the whole stream into an **in-memory** `app/utils/stream-store.ts` Map (5-min TTL, keyed by `runId`), then returns `{runId, threadId}`. The client opens a second request — `EventSource /chat/stream/:runId` — whose handler is a hand-rolled SSE forwarder.
- `index` rehydrates prior turns from Mastra memory via `recallChatMessages` and re-renders them (PRG `?threadId=`).
- `approve`/`decline`/`answer` gate on `verifyStreamOwner(runId, user.id)`, which reads an in-memory ownership Map.
- The shared modern chat controller (`app/actions/mastra/controller.tsx`) instead returns a **streaming `Response`** and pipes the agent `fullStream` through `app/utils/agent-sse.ts` (`sseHeaders`, `sseEvent`, `pipeStream`, `filterAndForward`). Its client uses `fetch` + `res.body.getReader()`.
- Agent runs + thread memory are already durable — `mastraStorage = PostgresStoreVNext` (`app/actions/mastra/storage.ts`). So a run and its thread survive restart/scale; only the in-memory `stream-store` and the ownership Map are non-durable.
- CSRF (`app/middleware/skip-csrf.ts`): agent endpoints (`/admin/support-agent`, `/admin/workflow-agent`, `/admin/agent-events`) skip CSRF but require `X-Sse-Request: 1` on non-GET. `/chat` is **not** in that list today, so it goes through `csrfMiddleware` with a hidden `_csrf` field.

## Goals / Non-Goals

**Goals:**
- Stream the customer chat reply on the **same POST request** (server-sent events) using the shared `agent-sse.ts` helpers.
- Remove the in-memory run store and the `/chat/stream/:runId` re-attach endpoint.
- Make run ownership **durable** so `approve`/`decline`/`answer` are correct across restart and scale.
- Make history **session/DOM-scoped** (no server-side Mastra-memory replay on load), while still persisting each turn to Mastra memory so the thread continues across turns.
- Adopt the modern client transport (`fetch` + reader) and the modern CSRF approach (`X-Sse-Request: 1`), keeping the slot picker, tool cards, reasoning, approval, and question UI.

**Non-Goals:**
- Agent-to-app frame navigation (`navigate`/prefill/Frame shell) — the customer chat stays self-contained.
- Parameterizing the shared admin `mastraChat` controller for a public identity — the customer controller stays separate; only its transport is modernized.
- Changing the customer agent's tools, the per-user rate limit, or the message validation rules.
- Persisting a *live* in-flight byte stream for mid-stream reconnection (matching the admin agents; the completed scenario survives via Mastra/PG, not via a buffered stream).

## Decisions

### Decision 1 — Direct streaming response (replace the buffered two-hop transport)

`action` returns the agent `fullStream` piped through `pipeStream`/`filterAndForward` from `app/utils/agent-sse.ts`, emitting SSE on the same POST response. Remove `stream-store.ts`, the `stream` action, `drainAndRebuild`, `setStream`/`getStream`/`verifyStreamOwner`, and the `/chat/stream/:runId` route.

- **Why:** removes the instance-local buffer (the only non-durable piece), eliminates the duplicated forwarder, and matches the admin agent chats. The run itself already survives via `PostgresStoreVNext`.
- **Alternatives considered:** keep the store but back it with Postgres/Redis. Rejected — reintroduces a re-attach endpoint and a buffered copy the modern agents deliberately avoid; adds latency and a redundant persistence layer when Mastra/PG already holds the run.

### Decision 2 — Client transport: `fetch` + `res.body.getReader()`

Replace the `EventSource`/`/stream/:runId` client with a `fetch('/chat', { method:'POST', body })` whose `body.getReader()` is parsed as SSE frames. Reuse the existing event-shape handling (`message`, `suspension`, `question`, `tool-*`, `reasoning-*`, `step-finish`, `complete`, `agent-error`, `stream-error`). Decompose the ~900-line `customer-chat-stream.tsx` monolith into a small SSE reader + the slot-picker widget + the approval/question cards (module boundaries left to implementation).

- **Why:** POST streaming needs the request body; `EventSource` cannot POST a body and required the removed re-attach endpoint.
- **Alternatives considered:** keep `EventSource` by keeping `/stream/:runId`. Rejected (contradicts Decision 1) — leaves the in-memory buffer in place.

### Decision 3 — Session/DOM-scoped history

`index` renders an empty conversation area. The client holds `threadId` and sends it on each subsequent POST; `agent.stream` writes each turn to Mastra memory under `{ thread: threadId, resource: String(user.id) }` so the thread persists. `recallChatMessages` is no longer called on GET; the PRG `?threadId=` replay is dropped.

- **Why:** matches the admin agent chats ("like admin") and removes the server-side memory read on load.
- **Alternatives considered:** keep server replay. Rejected per scope.

### Decision 4 — Durable run ownership (new `chat_runs` mapping)

At run start in `action` (we already hold `user.id` and `threadId`, and receive `output.runId`), insert `{ runId, userId, threadId, createdAt }` into a new app table. `approve`/`decline`/`answer` look up the row by `runId` and reject if `userId !== currentUser.id`. Delete the row when a run reaches a terminal state (approve/decline/answer resolution); a TTL bounds growth for runs abandoned while suspended.

- **Why:** explicit, indexed, instance-agnostic, and does not depend on Mastra vendor internals. The run start already has the data, so the write is trivial.
- **Alternatives considered:** (a) derive ownership from Mastra storage by resolving `run → thread → resource`. Rejected — couples to `PostgresStoreVNext` row schema (not a guaranteed supported query path) and to `recall` semantics; less robust than an explicit mapping.

### Decision 5 — CSRF: agent-endpoint pattern

Add `/chat` and `/chat/*` to `AGENT_PATHS` in `app/middleware/skip-csrf.ts`. The customer chat client sets `X-Sse-Request: 1` on all non-GET `fetch` calls (message, approve, decline, answer). Remove the hidden `#chat-csrf-token`/`_csrf` field.

- **Why:** the stream client cannot embed a form token (same reason as the admin agents), and the endpoint is already session-authenticated + per-user rate-limited. The `X-Sse-Request` header requirement blocks cross-site `<form>` POSTs.
- **Trade-off:** opens the endpoint to cross-site requests that do set custom headers; mitigated by the header requirement and existing auth/rate-limit. (Consistent with the admin agent precedent; flag to the security reviewer.)

## Risks / Trade-offs

- **[Live stream loss on restart]** The in-flight byte stream is lost if the server restarts mid-turn → This matches the admin agents and is out of scope (Non-Goal). The run/messages survive via Mastra/PG, so approve/resume and subsequent turns still work.
- **[Ownership correctness with the new table]** A miswritten/leaked `chat_runs` row could wrongly authorize → Mitigate with the index, a whitelist write path (only `action` inserts), deletion on terminal resolution, and unit tests covering cross-user rejection.
- **[CSRF relaxation]** Moving `/chat` off `csrfMiddleware` removes form-token protection → Mitigate by requiring `X-Sse-Request: 1` (as the admin agents do), keep `requireAuth` + rate limiting, and get a security review.
- **[Behavior change for existing clients/tests]** Removing `/stream/:runId`, the `?threadId=` replay, and `_csrf` breaks the current client and tests → All in the same change; update `app/actions/chat/controller.test.ts` and the customer-chat stream client together.
- **[Chatlog/history consumer]**: code that previously read server-rendered history (e.g., admin chatlog views) relies on Mastra memory, not this route's render → Verify chatlog views use Mastra memory/DB, not the `/chat` GET re-render, so dropping the replay doesn't break them.

## Migration Plan

1. Land the durable `chat_runs` table (schema + migration) and the ownership module first — additive, no wiring yet.
2. Rewrite `action` to stream SSE and record the run mapping; add the X-Sse-Request CSRF path; remove the `stream` action, `/stream/:runId` route, and `stream-store.ts`.
3. Rewrite the client to `fetch`+reader and drop the hidden `/stream/:runId`/`_csrf` handling; update `index` to render empty.
4. Update `app/actions/chat/controller.test.ts` and add ownership (cross-user) + streaming tests.
5. Gate/verify: `npm run typecheck`, `npm run lint`, `npm test`; manual smoke of a booked appointment via the slot picker, and an approval suspension.

**Rollback:** revert the route/client change is atomic (single route + client module). The `chat_runs` table is additive and safe to leave; the ownership paths fall back to reject if the row is absent (deny-by-default), so rollback of the controller removes the table usage without leaving a security hole.

## Open Questions

- Should the `chat_runs` cleanup be TTL-based only, or also tied to Mastra's run lifecycle (e.g., a suspension-lifetime window)? Deferrable — either satisfies the spec; pick during implementation.
- Is there an existing chatlog/history consumer that must keep seeing server-rendered history on the `/chat` GET? Deferrable — verify against `admin.chatlog` before finalizing the `index` change.
