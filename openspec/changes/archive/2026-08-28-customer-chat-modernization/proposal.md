## Why

The public `/chat` route still runs the pre-modern agent-chat transport: the POST handler drains the agent stream into an **in-memory** `stream-store` Map, then the client opens a second request (`EventSource /chat/stream/:runId`) to read it back. That in-memory state is lost on restart or scale (a client cannot reattach, and an owner check is per-process), the forward loop is a hand-rolled duplicate of the shared `agent-sse.ts` helpers the newer agent chats already use, and the controller's `index` replays Mastra history into the page where the newer agent chats do not. We want `/chat` on the same modern transport (streaming `Response` + shared `agent-sse.ts` + fetch/reader client) with durable run ownership, while keeping it a self-contained public chat.

## What Changes

- Replace the buffered two-hop stream with a **direct streaming `Response`** from the `action` handler — the agent `fullStream` is piped into the response body via `pipeStream`/`filterAndForward` from `app/utils/agent-sse.ts`.
- **Remove** the in-memory `stream-store` and the `/chat/stream/:runId` route, `stream` action, and `drainAndRebuild`.
- Switch the client from `EventSource`+DOM monolith to `fetch` + `res.body.getReader()` consuming the shared SSE events; keep the slot-picker, tool cards, reasoning, approval, and question UI.
- Make **run ownership durable**: `approve`/`decline`/`answer` no longer gate on the in-memory `verifyStreamOwner` map; ownership is derived from persistent Mastra/Postgres state (see design — spike resolves a vs b).
- **History becomes session/DOM-scoped** like the admin agent chats: `index` renders an empty chat and no longer replays Mastra memory (drops the PRG `?threadId=` re-render), while `agent.stream` still writes each turn to Mastra memory under the thread/resource.
- Consolidate onto the shared SSE helpers; drop the per-controller duplicate forwarder and the hidden `#chat-csrf-token` attribute (adopt the modern agent-endpoint CSRF approach).
- **BREAKING (in-app API surface):** `GET /chat/stream/:runId` and the `?threadId=` replay path are removed; the router tree and the customer chat client/tests are updated in the same change.

## Capabilities

### New Capabilities

- `customer-chat`: the customer-facing agent chat — direct streaming transport, no in-memory run store, session/DOM-scoped history (not a server-side Mastra-memory replay on load), and durable run ownership for approve/decline/answer. Preserves the customer agent's tools (slot search, capability search, booking) and the per-user rate limit, and keeps the chat as the whole interface (no agent-to-app frame navigation).

### Modified Capabilities

- (none — existing agent-chat specs describe the admin agents / shared infrastructure, which this change adopts but does not alter.)

## Impact

- `app/actions/chat/controller.tsx` — rewrite `action` to stream SSE; remove `stream`, `drainAndRebuild`, in-memory owner/store usage; make `approve`/`decline`/`answer` ownership durable; `index` no longer recalls history.
- `app/routes.ts` — remove `routes.chat.stream` (`get('/stream/:runId')`).
- `app/utils/stream-store.ts` — deleted (and its tests).
- `app/assets/streams/public/customer-chat-stream.tsx` — fetch/reader client for shared SSE; keep slot-picker/tool/reasoning/approval/question rendering (compose rather than one monolith).
- `app/ui/customer-chat-page.tsx` — drop `messages`/`threadId`/PRG `error` replay props; render an empty chat area.
- `app/utils/agent-sse.ts` — reused as-is (no infrastructure change).
- `app/actions/chat/controller.test.ts` — update for the new transport and durable ownership.
- CSRF middleware for the agent endpoints, as already done for the admin agent chats.
