## 1. Shared Utilities

- [x] 1.1 Create `app/utils/logger.ts` — user-aware logging utility (ported from my_app)
- [x] 1.2 Create `app/utils/rate-limiter.ts` — configurable rate limiter factory (ported from my_app)
- [x] 1.3 Create `app/utils/ai-provider.ts` — AI provider config with OpenCode gateway (ported from my_app, adapted)
- [x] 1.4 Create `app/utils/error-handling.ts` — toastRedirect and error helpers (ported from my_app)
- [x] 1.5 Create `app/lib/chatlog.ts` — conversation persistence with create/read/append/delete operations (ported from my_app, adapted)

## 2. Database Schema & Seeding

- [x] 2.1 Add `chatlog` table definition to `app/data/schema.ts`
- [x] 2.2 Add `chatlog` table creation and index to `app/data/setup.ts`

## 3. UI Components

- [x] 3.1 Create `app/ui/form-loading-state.tsx` — client-entry component for button loading state on chat/agent forms
- [x] 3.2 Create `app/ui/scroll-to-top.tsx` — client-entry component to scroll messages container to top on new messages

## 4. Routes

- [x] 4.1 Add `chat` and `agent` route definitions to `app/routes.ts` (index + action sub-routes)
- [x] 4.2 Create `app/actions/chat-controller.tsx` — chat route controller with GET index and POST action
- [x] 4.3 Create `app/actions/agent-controller.tsx` — agent route controller with GET index and POST action, including `get_weather` and `search_wikipedia` tools

## 5. Router & Navigation

- [x] 5.1 Wire chat and agent controllers in `app/router.ts`
- [x] 5.2 Add Chat and Agent nav items to `app/ui/nav.ts`

## 6. Verify

- [x] 6.1 Run `pnpm run typecheck` to verify no type errors
- [x] 6.2 Run `pnpm run lint` to verify no lint issues
- [x] 6.3 Run `pnpm test` to verify existing tests still pass
