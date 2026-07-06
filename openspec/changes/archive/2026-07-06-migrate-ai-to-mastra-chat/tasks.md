## 1. Weather tool

- [x] 1.1 Add `get_weather` tool to `app/actions/mastra/tools/support-tools.ts` using `createTool` from `@mastra/core/tools` with Zod v4 `inputSchema` (`location: z.string().min(1).max(30)`), copying the Open-Meteo geocoding + forecast URLs, the weather-code mapping table, and the 10s timeout from `app/workflows/tools.ts`
- [x] 1.2 Update `app/actions/mastra/agents/support-agent.ts` `instructions` to list `get_weather` alongside the existing tools and describe when to use it
- [x] 1.3 Add a unit test for `get_weather` covering the success response shape, unknown-location error, and timeout abort

## 2. Mastra chat controller: stop double-writing to chatlog

- [x] 2.1 Remove `createConversation`/`appendMessage`/`getConversation` imports from `app/data/chatlog.ts` in `app/actions/mastra/controller.tsx`
- [x] 2.2 Remove the `appendMessage` calls for user and assistant messages; rely on `agent.generate(message, { memory: { thread: threadId, resource: String(user.id) } })` to persist both
- [x] 2.3 Keep `generateId` from `ai` for minting `threadId` when none is supplied; keep the `THREAD_ID_RE` validation and rate limiter
- [x] 2.4 Update the `index` action to load the last assistant response from Mastra memory via `memory.recall({ threadId, perPage: false })` instead of `getConversation`
- [x] 2.5 Update `app/actions/mastra/controller.test.ts` to assert no calls to `chatlog` helpers and that memory recall is used for the `index` action

## 3. Admin chatlog viewer: read from Mastra memory

- [x] 3.1 Rewrite `app/actions/admin/chatlog/controller.tsx` `index` action to obtain `mastra.getAgent('supportAgent').getMemory()` and call `memory.listThreads({ page, perPage, orderBy: { field: 'createdAt', direction: 'DESC' } })`; map `StorageThreadType` to the existing row props
- [x] 3.2 Rewrite the chatlog fragments controller's `detail` action to call `memory.recall({ threadId, perPage: false })` and map `MessageType` to the existing `ChatMessage`-shaped props
- [x] 3.3 Rewrite the `destroy` action to delete the thread (and its messages) via Mastra memory/storage, keeping the `logAdminAction` audit entry with `target_type: 'chatlog'`
- [x] 3.4 Drop the `type` query param parsing and the `type` filter from the controller; remove the `getAllConversations` import
- [x] 3.5 Update `app/actions/admin/chatlog/controller.test.ts` (and any fragment tests) to use a fake Mastra memory implementing `listThreads`/`recall`/delete

## 4. Admin chatlog UI: drop chat/agent distinction

- [x] 4.1 Update `app/ui/admin-chatlog-page.tsx` to remove the `type` prop, the type filter label, and the chat-vs-agent badge logic
- [x] 4.2 Repoint the row "open" link from `/ai/agent?agentId=` / `/ai/chat?chatId=` to `/mastra/chat?threadId=<id>`
- [x] 4.3 Update `app/assets/chatlog-row-detail.tsx` if it references the removed `type` or tool-call-based badge
- [x] 4.4 Verify the empty state still renders when `listThreads` returns no threads

## 5. Remove the legacy /ai route tree

- [x] 5.1 Remove the `ai` route branch from `app/routes.ts` (index, chat, agent, workflow, fragments) and the `aiContent` frame entry
- [x] 5.2 Remove the `ai*` imports and all `router.map(routes.ai.*)` calls from `app/router.ts`
- [x] 5.3 Delete `app/actions/ai/` (controller.tsx and all `.test.ts` files)
- [x] 5.4 Delete `app/ui/ai-layout.tsx`, `app/ui/ai-page.tsx`, `app/ui/chat-page.tsx`, `app/ui/agent-page.tsx`, `app/ui/workflow-page.tsx`, `app/ui/workflow-run-page.tsx`, `app/ui/workflow-parameters.tsx`, and `app/ui/ai-fragments/`

## 6. Remove orphaned workflows + chatlog data layer

- [x] 6.1 Delete `app/workflows/` (registry, engine, definitions, tools, types) — only after step 5 confirms no imports remain
- [x] 6.2 Delete `app/data/chatlog.ts` — only after steps 2 and 3 confirm no imports remain
- [x] 6.3 Grep the repo for any remaining references to `chatlog`, `baseTools`, `listWorkflows`, `getWorkflow`, `createWorkflowRun`, and remove/replace them

## 7. Navigation updates

- [x] 7.1 In `app/ui/nav.ts`, change the `KI` nav item `href` from `/ai` to `/mastra/chat` and mark it `adminOnly: true`
- [x] 7.2 In `app/ui/admin-layout.tsx`, remove the `chatonly` and `agentonly` nav items and their icon cases; keep the `support` item pointing at `routes.mastra.chat.index`
- [x] 7.3 Remove the `chatonly`/`agentonly` entries from the `AdminNavItem` union type

## 8. Verification

- [x] 8.1 Run `npm run typecheck` and fix any dangling imports/type errors
- [x] 8.2 Run `npm test` and ensure the mastra and admin chatlog tests pass; remove/replace any tests that depended on the deleted `/ai` routes or `chatlog` table
- [ ] 8.3 Run `npm run start` and smoke-test: `/mastra/chat` loads, a weather query works, `/admin/chatlog` lists Mastra threads, a thread detail opens, and `/ai/*` returns 404
- [ ] 8.4 Commit with conventional commits (e.g., `feat: consolidate ai routes into /mastra/chat`, `refactor: drop legacy /ai tree and chatlog table`)