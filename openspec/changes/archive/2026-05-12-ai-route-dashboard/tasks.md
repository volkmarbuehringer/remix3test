## 1. Route and Router Restructure

- [x] 1.1 Restructure `aiRoutes` in `routes.ts` — nest chat and agent under `route('ai', ...)`, add `frames.aiContent`
- [x] 1.2 Update `router.ts` — map `aiRoutes.ai` (dashboard), `aiRoutes.ai.chat`, and `aiRoutes.ai.agent`
## 2. AI Layout and Dashboard (new files)

- [x] 2.1 Create `app/ui/ai-layout.tsx` — sidebar layout with nav groups (mirrors admin-layout.tsx)
- [x] 2.2 Create `app/ui/ai-page.tsx` — dashboard index page with overview cards
- [x] 2.3 Create `app/actions/ai-controller.tsx` — controller for `/ai` dashboard

## 3. Update Internal Links and Redirects

- [x] 3.1 Update `app/ui/nav.ts` — change Chat/Agent hrefs to `/ai/chat` and `/ai/agent`, add AI Dashboard link
- [x] 3.2 Update `app/actions/chat-controller.tsx` — change redirect URLs from `/chat` to `/ai/chat`
- [x] 3.3 Update `app/actions/agent-controller.tsx` — change redirect URLs from `/agent` to `/ai/agent`
- [x] 3.4 Update `app/ui/admin-chatlog-page.tsx` — change conversation links from `/chat?chatId=` to `/ai/chat?chatId=` and `/agent?agentId=` to `/ai/agent?agentId=`
- [x] 3.5 Update `app/ui/chat-page.tsx` — change form action reference from `aiRoutes.chat` to `aiRoutes.ai.chat`
- [x] 3.6 Update `app/ui/agent-page.tsx` — change form action reference from `aiRoutes.agent` to `aiRoutes.ai.agent`
- [x] 3.7 Update `app/actions/chat-controller.tsx` — change `createController` type from `typeof routes.chat` to `typeof routes.ai.chat`
- [x] 3.8 Update `app/actions/agent-controller.tsx` — change `createController` type from `typeof routes.agent` to `typeof routes.ai.agent`

## 4. Verification

- [x] 4.1 Run `pnpm typecheck` to confirm no type errors
- [x] 4.2 Run `pnpm test` to confirm all tests pass
