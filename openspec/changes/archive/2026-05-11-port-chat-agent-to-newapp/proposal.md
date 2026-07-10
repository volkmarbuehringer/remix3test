## Why

The newapp project needs AI-powered chat and agent functionality, which already exists in my_app. Porting these routes avoids rebuilding from scratch while adapting them to newapp's existing theme system, router patterns, and database setup. This gives newapp feature parity with my_app's conversational AI capabilities.

## What Changes

- Add `/chat` route with full message history and LLM-powered responses
- Add `/agent` route with tool-calling capabilities (weather lookup, Wikipedia search)
- Add `chatlog` database table and seed schema for conversation persistence
- Create shared utilities: AI provider config, rate limiter, user logger, error handling helpers
- Create UI components: form loading state, scroll-to-top
- Wire routes into newapp's existing router, nav, and layout
- Adapt all code to newapp's theme system (remix-components) and coding patterns

**No changes to**:

- `package.json` (dependencies already installed)
- Existing auth, database, or middleware infrastructure
- Existing routes or functionality

## Capabilities

### New Capabilities

- `chat-route`: Simple conversational chat with LLM via `ai` package, conversation persistence in `chatlog` table, SSR-rendered message history
- `agent-route`: Tool-calling agent using `ToolLoopAgent` from the `ai` package with `get_weather` and `search_wikipedia` tools, conversation persistence, tool call metadata display
- `chatlog-persistence`: Database-backed conversation storage with create/read/append operations and optimistic concurrency control
- `ai-provider-config`: Shared OpenAI-compatible provider setup pointing at the OpenCode API gateway
- `rate-limiter`: Configurable per-user and global rate limiting for chat/agent endpoints

### Modified Capabilities

- (none — no existing specs to modify)

## Impact

**New files** (ported from my_app, adapted to newapp conventions):

- `app/actions/chat-controller.tsx` — Chat route controller
- `app/actions/agent-controller.tsx` — Agent route controller
- `app/lib/chatlog.ts` — Conversation persistence library
- `app/utils/ai-provider.ts` — AI model provider configuration
- `app/utils/logger.ts` — User-aware logging utility
- `app/utils/rate-limiter.ts` — Rate limiter factory
- `app/utils/error-handling.ts` — Error handling helpers (toastRedirect, etc.)
- `app/ui/form-loading-state.tsx` — Client-side form loading state component
- `app/ui/scroll-to-top.tsx` — Client-side scroll-to-top component

**Modified files**:

- `app/routes.ts` — Add `chat` and `agent` route definitions
- `app/router.ts` — Wire chat and agent controllers
- `app/data/schema.ts` — Add `chatlog` table definition
- `app/data/setup.ts` — Add `chatlog` table creation and seed
- `app/ui/nav.ts` — Add Chat and Agent navigation items
- `app/assets.ts` — Ensure asset server covers new client entry files

**Dependencies**: Already present in newapp's package.json (`ai`, `@ai-sdk/openai-compatible`, `@ai-sdk/devtools`, `zod`, `remix`).
