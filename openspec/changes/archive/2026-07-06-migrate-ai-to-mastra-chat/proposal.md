## Why

The app currently carries two parallel AI surfaces: a legacy `/ai` route tree (`/ai`, `/ai/chat`, `/ai/agent`, `/ai/workflow`, `/ai/fragments/agent-result`) built on the raw `ai` SDK with a hand-rolled `chatlog` table, and a newer `/mastra/chat` route built on the Mastra framework with its own `supportAgent`, tools, and Postgres-backed memory. Maintaining both doubles the surface area for bugs, splits conversation history across two stores, and forces the admin chatlog viewer to distinguish "chat" vs "agent" conversations based on the presence of tool calls — a distinction that no longer reflects how the product is used. Now that the Mastra agent is the supported path, the legacy tree should be retired and its one still-useful capability (the `get_weather` tool) folded into the Mastra agent so there is a single AI route and a single conversation store.

## What Changes

- **BREAKING**: Remove the entire `/ai` route tree — `routes.ai.index`, `routes.ai.chat`, `routes.ai.agent`, `routes.ai.workflow`, and `routes.ai.fragments` — along with `app/actions/ai/controller.tsx`, its tests, the `ai`-specific UI (`ai-layout.tsx`, `ai-page.tsx`, `chat-page.tsx`, `agent-page.tsx`, `workflow-page.tsx`, `workflow-parameters.tsx`, `workflow-run-page.tsx`, `ui/ai-fragments/`), and the `aiContent` frame.
- **BREAKING**: Remove the `ai` route branch from `app/routes.ts` and all `router.map(routes.ai.*)` wiring in `app/router.ts`.
- Port the `get_weather` tool from `app/workflows/tools.ts` into the Mastra support agent's toolset at `app/actions/mastra/tools/support-tools.ts` (as a `createTool`-style Mastra tool), and add it to `supportAgent.instructions`'s tool list.
- Remove the chat/agent distinction in the admin chatlog viewer: drop the `type` query param, the `chatonly`/`agentonly` nav items, the chat-vs-agent badge logic, and the `type` filter in `getAllConversations` in `app/data/chatlog.ts`.
- Migrate the admin chatlog viewer (`/admin/chatlog`, `app/actions/admin/chatlog/controller.tsx`, `app/ui/admin-chatlog-page.tsx`) to read conversation history from Mastra's `threads` and `messages` tables (exposed via `mastraStorage` / `@mastra/memory`) instead of the legacy `chatlog` table, so old dialogs are viewable alongside new ones in a single store.
- Stop the `/mastra/chat` controller from double-writing to the legacy `chatlog` table (`createConversation`/`appendMessage` from `data/chatlog.ts`); rely on Mastra memory as the single source of truth for threads/messages.
- Update navigation: replace the main-nav `KI` link (`/ai`) with `/mastra/chat` (admin-only), and update the admin sidebar `Support-Agent` item to remain the entry point to `/mastra/chat`.
- Update the admin chatlog row detail links that currently point to `/ai/agent?agentId=` and `/ai/chat?chatId=` to point to `/mastra/chat?threadId=` instead.
- Remove the now-orphaned `app/workflows/` registry/engine and `app/data/chatlog.ts` once no callers remain (the workflow runner was only reachable via `/ai/workflow`).

## Capabilities

### New Capabilities

- `mastra-weather-tool`: A weather lookup tool added to the Mastra support agent, providing current temperature, condition, humidity, and wind speed for any location worldwide via the Open-Meteo API.
- `mastra-chatlog-viewer`: Admin-only viewer at `/admin/chatlog` that reads conversation history from Mastra's threads/messages tables and renders all past dialogs without a chat/agent type distinction.

### Modified Capabilities

<!-- No existing spec-level capabilities are modified; the legacy /ai routes and chat/agent distinction were never captured as specs in openspec/specs/. -->

## Impact

- **Routes**: `app/routes.ts` (remove `ai` branch), `app/router.ts` (remove `ai*` imports and `router.map` calls).
- **Controllers**: delete `app/actions/ai/`; simplify `app/actions/mastra/controller.tsx` (drop `chatlog.ts` writes); rewrite `app/actions/admin/chatlog/controller.tsx` to query Mastra memory.
- **UI**: delete `app/ui/ai-*`, `chat-page.tsx`, `agent-page.tsx`, `workflow-*.tsx`; update `app/ui/admin-chatlog-page.tsx`, `app/ui/admin-layout.tsx`, `app/ui/nav.ts`.
- **Data**: delete `app/data/chatlog.ts` and `app/workflows/` once unused; add Mastra-threaded read helpers.
- **Tests**: delete `app/actions/ai/*.test.ts`; update `app/actions/mastra/controller.test.ts` and admin chatlog tests to reflect the new store and removed type filter.
- **Dependencies**: no new npm deps; `ai` SDK remains for `generateId` if still needed elsewhere, otherwise removable from the mastra path.
- **Migration**: existing rows in the legacy `chatlog` table are not auto-migrated; admins can still view them until the table is dropped, but new conversations are written only to Mastra memory. A one-time backfill script is out of scope for this change.
