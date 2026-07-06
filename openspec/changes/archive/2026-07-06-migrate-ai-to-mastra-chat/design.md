## Context

The app has two AI surfaces today:

1. **Legacy `/ai` tree** (`app/actions/ai/controller.tsx`) — uses the raw `ai` SDK (`generateText`, `ToolLoopAgent`) and persists conversations to a hand-rolled `chatlog` Postgres table via `app/data/chatlog.ts`. It exposes `/ai` (dashboard), `/ai/chat` (plain chat), `/ai/agent` (tool-loop agent with `get_weather` + `search_wikipedia`), `/ai/workflow` (workflow runner over `app/workflows/`), and `/ai/fragments/agent-result`.
2. **Newer `/mastra/chat`** (`app/actions/mastra/controller.tsx`) — uses the Mastra `supportAgent` with `supportTools` (`lookup_user`, `list_recent_appointments`, `count_users`, `get_current_date_time`) and Postgres-backed `Memory` (`mastraStorage`). It currently *also* double-writes to the legacy `chatlog` table via `createConversation`/`appendMessage`.

The admin chatlog viewer at `/admin/chatlog` reads from the legacy `chatlog` table and splits conversations into `type=chat` vs `type=agent` based on whether any message has `toolCalls`. The admin sidebar exposes `chatonly` and `agentonly` filter links. Row detail links point to `/ai/agent?agentId=` or `/ai/chat?chatId=`.

The main nav exposes a `KI` link to `/ai`.

Constraints:
- Remix 3 route tree, `createController`, `requireAuth`/`requireAdmin` middleware.
- Mastra `PostgresStore` auto-creates `mastra_*` tables (threads, messages, etc.) on first access.
- The `get_weather` tool in `app/workflows/tools.ts` is the only legacy capability worth porting; `search_wikipedia` and the workflow runner are not used by the Mastra agent.
- Conventional commits; no React (Remix UI templates).

## Goals / Non-Goals

**Goals:**
- Collapse to a single AI route: `/mastra/chat`.
- Port `get_weather` into the Mastra support agent's toolset.
- Make Mastra memory the single source of truth for conversation history; stop double-writing to `chatlog`.
- Make `/admin/chatlog` read threads/messages from Mastra memory and drop the chat/agent type distinction.
- Remove the legacy `/ai` route tree, its controller, UI, tests, and the orphaned `app/workflows/` registry/engine and `app/data/chatlog.ts`.
- Update navigation so the only AI entry point is `/mastra/chat` (admin-only).

**Non-Goals:**
- Auto-backfilling legacy `chatlog` rows into Mastra `threads`/`messages` tables. Old rows remain queryable in Postgres until the table is dropped, but the admin viewer no longer reads them. A backfill script may be a follow-up change.
- Porting `search_wikipedia` or the workflow runner to Mastra. They are removed without replacement.
- Changing the Mastra agent's model provider, scorers, or working-memory configuration.
- Adding streaming/SSE to `/mastra/chat` (the current request/response form flow is preserved).

## Decisions

### Decision 1: Port `get_weather` as a Mastra `createTool`, not the raw `ai` SDK `tool`
**Choice:** Re-implement the Open-Meteo weather lookup using `createTool` from `@mastra/core/tools` with a Zod v4 `inputSchema`, matching the existing `supportTools` style.
**Rationale:** The Mastra agent only accepts Mastra tools; the raw `ai` SDK `tool` shape is incompatible. Keeping the same Open-Meteo geocoding + forecast endpoints and the same weather-code mapping table preserves behavior.
**Alternatives considered:** Wrap the existing `baseTools.get_weather` in an adapter — rejected because it couples the Mastra agent to the `ai` SDK and the soon-to-be-deleted `app/workflows/tools.ts`.

### Decision 2: Single source of truth = Mastra memory; drop the `chatlog` table writes
**Choice:** In `app/actions/mastra/controller.tsx`, remove the `createConversation`/`appendMessage` calls from `data/chatlog.ts`. The agent's `generate(message, { memory: { thread: threadId, resource: String(user.id) } })` call already persists user + assistant messages to Mastra memory. Generate `threadId` with Mastra's thread ID format (or keep `generateId()` from `ai` for the thread ID string — it's a valid opaque ID).
**Rationale:** Eliminates the double-write and the divergence risk between stores. Mastra memory already stores tool calls and usage in its message rows.
**Alternatives considered:** Keep `chatlog` as the canonical store and read Mastra memory only for new threads — rejected because it preserves the chat/agent split the user wants removed.

### Decision 3: Admin chatlog viewer reads via `agent.getMemory()` + `listThreads` / `recall`
**Choice:** Rewrite `app/actions/admin/chatlog/controller.tsx` to obtain `mastra.getAgent('supportAgent').getMemory()`, then call `memory.listThreads({ page, perPage, orderBy: { field: 'createdAt', direction: 'DESC' } })` for the list and `memory.recall({ threadId, perPage: false })` for the detail fragment. Map Mastra `StorageThreadType` and `MessageType` to the existing `ChatLogRow`/`ChatMessage`-shaped props the UI already consumes.
**Rationale:** Uses the supported Mastra API rather than hand-rolling SQL against `mastra_threads`/`mastra_messages`, so schema changes in Mastra upgrades don't break the viewer.
**Alternatives considered:** Query `mastra_threads`/`mastra_messages` directly via `pool` — rejected as fragile and coupled to Mastra's internal schema.

### Decision 4: Remove the chat/agent type distinction entirely
**Choice:** Drop the `type` query param, the `chatonly`/`agentonly` nav items and icons, the `type` filter in `getAllConversations`, and the chat-vs-agent badge in `admin-chatlog-page.tsx`. Row detail links become a single `/mastra/chat?threadId=<id>` link.
**Rationale:** With one AI route and one store, the distinction is meaningless.
**Alternatives considered:** Keep the badge based on whether a thread's messages include tool calls — rejected as noise that no longer maps to a product concept.

### Decision 5: Delete `app/workflows/` and `app/data/chatlog.ts` in the same change
**Choice:** Remove `app/workflows/` (registry, engine, definitions, tools, types) and `app/data/chatlog.ts` once the `/ai` tree and the mastra double-write are gone, since no remaining code references them.
**Rationale:** Avoids leaving dead code that rots and confuses future agents. The `get_weather` logic is preserved by copy into `support-tools.ts`.
**Alternatives considered:** Keep `app/workflows/tools.ts` as a shared tools module — rejected because only `get_weather` is reused and it's small enough to inline.

### Decision 6: `threadId` generation stays on `generateId()` from `ai`
**Choice:** Keep `import { generateId } from 'ai'` in the mastra controller to mint a thread ID when none is supplied.
**Rationale:** Mastra memory accepts arbitrary opaque thread IDs; `generateId` is already a dependency and produces URL-safe IDs matching the existing `THREAD_ID_RE`.
**Alternatives considered:** Switch to Mastra's `memory.createThread({ resourceId })` which returns a generated ID — viable, but adds a round trip and changes the ID format; defer.

## Risks / Trade-offs

- **[Risk] Legacy `chatlog` rows become unviewable in the admin UI** → Mitigation: document in the proposal that old rows remain in Postgres and can be queried directly or backfilled in a follow-up; the viewer explicitly shows an empty state when no Mastra threads exist yet.
- **[Risk] Mastra `listThreads`/`recall` access control is app-level** → Mitigation: the admin chatlog controller is already gated by `requireAuth() + requireAdmin()`; the mastra chat controller passes `resource: String(user.id)` so threads are per-user. The admin viewer lists all threads (admin scope) which matches the current admin behavior of seeing all conversations.
- **[Risk] `get_weather` port introduces subtle behavior drift** → Mitigation: copy the geocoding + forecast URLs, the weather-code mapping table, and the 10s timeout verbatim; add a unit test for the tool's response shape.
- **[Risk] Removing `app/workflows/` breaks an import not caught by grep** → Mitigation: run `npm run typecheck` after deletion; the task list includes a typecheck gate.
- **[Trade-off] No streaming** → The form-based request/response flow remains; users still get a redirect after the agent finishes. Acceptable for this change.
- **[Trade-off] `search_wikipedia` and the workflow runner are dropped without replacement** → Acceptable per the user's request; only `get_weather` is preserved.

## Migration Plan

1. **Add** `get_weather` to `support-tools.ts` and update `supportAgent.instructions` to list it.
2. **Rewrite** `app/actions/admin/chatlog/controller.tsx` (and its fragment controller) to read from Mastra memory; update `app/ui/admin-chatlog-page.tsx` to drop the type filter and repoint row links to `/mastra/chat?threadId=`.
3. **Simplify** `app/actions/mastra/controller.tsx` to stop writing to `chatlog` (remove `createConversation`/`appendMessage` imports and calls).
4. **Remove** the `/ai` route branch from `app/routes.ts`, the `ai*` imports and `router.map` calls in `app/router.ts`, the `aiContent` frame, and delete `app/actions/ai/`, `app/ui/ai-*`, `chat-page.tsx`, `agent-page.tsx`, `workflow-*.tsx`, `app/ui/ai-fragments/`.
5. **Delete** `app/workflows/` and `app/data/chatlog.ts`.
6. **Update** navigation: `app/ui/nav.ts` `KI` link → `/mastra/chat` (admin-only); `app/ui/admin-layout.tsx` remove `chatonly`/`agentonly` items and keep `support` pointing at `/mastra/chat`.
7. **Update/delete tests**: remove `app/actions/ai/*.test.ts`; update `app/actions/mastra/controller.test.ts` to assert no `chatlog` writes; update admin chatlog tests to use a fake Mastra memory.
8. **Verify**: `npm run typecheck`, `npm test`, `npm run start` smoke.

**Rollback:** Revert the commit; the legacy `chatlog` table and `/ai` routes return. No DB migration is applied or rolled back (Mastra tables are created idempotently by `PostgresStore.init()`).

## Open Questions

- Should the admin chatlog viewer paginate threads via `listThreads` `page`/`perPage` (server-side) or load all and paginate client-side? **Proposed:** server-side with `perPage` matching the current `CHATLOG_PAGE_SIZE` of 5, preserving the existing "load N+1 to detect hasMore" pattern.
- Should `threadId` be minted via `memory.createThread` (which lets Mastra set metadata like `title`) instead of `generateId`? **Deferred** to a follow-up; current behavior is preserved.