# AI Routes Port: Bookstore → my_app

## Summary

Port the Chat, Agent, and Admin Chatlog AI routes from the `bookstore` project to the `my_app` project, preserving the same route paths, functionality, and UI patterns.

## What's Being Ported

### Routes

| Route | Source | Destination |
|-------|--------|-------------|
| `/chat` | `bookstore/app/controllers/chat/` | `my_app/app/controllers/chat/` |
| `/agent` | `bookstore/app/controllers/agent/` | `my_app/app/controllers/agent/` |
| `/admin/chatlog` | `bookstore/app/controllers/admin/chatlog.tsx` + `chatlog/page.tsx` | Same paths in my_app |

### Chat (`/chat`)
- Simple chatbot using the `ai` package's `streamText` API
- Conversation history saved to DB (chatlog table)
- POST-redirect-GET pattern (POST to send message, redirects to GET with `chatId` query param)
- Shows elapsed time and token usage per message
- Messages displayed reverse-chronological (newest on top)

### Agent (`/agent`)
- Tool-loop agent using `ai` package's `ToolLoopAgent`
- Two tools: `get_weather` (Open-Meteo API) and `search_wikipedia` (Wikipedia API)
- Same conversation persistence and POST-redirect-GET as Chat
- Shows tool calls, tool inputs, tool results inline in message bubbles
- Per-message token and elapsed time display

### Admin Chatlog (`/admin/chatlog`)
- Admin-only page listing all conversations
- Text search/filter across conversation content
- Auto-detects Agent vs Chat conversations (based on presence of tool calls)
- Links back to the appropriate viewer (`/chat?chatId=` or `/agent?agentId=`)
- Expandable message details

## What's NOT Being Ported

- **agent2** (`/agent2`) — explicitly excluded by user; requires full workflow engine
- **Messages** (`/messages`) — already exists in my_app with different implementation
- **SSE subscriptions** — not part of this scope

## Architecture

### Database: `chatlog` Table

```sql
CREATE TABLE IF NOT EXISTS chatlog (
  id TEXT PRIMARY KEY,
  conversation JSONB NOT NULL DEFAULT '[]',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
```

### New Files

```
my_app/app/
├── data/
│   ├── schema.ts          ← Add chatlog table definition
│   └── setup.ts           ← Add chatlog CREATE TABLE + index
├── lib/
│   └── chatlog.ts          ← Conversation CRUD (createConversation, getConversation, appendMessage, getAllConversations)
├── utils/
│   ├── ai-provider.ts      ← OpenCode AI model setup (OPENCODE_API_KEY)
│   └── logger.ts           ← User-prefixed console logging
├── controllers/
│   ├── chat/
│   │   ├── controller.tsx  ← GET/POST handler for /chat
│   │   └── page.tsx        ← Chat UI component
│   ├── agent/
│   │   ├── controller.tsx  ← GET/POST handler for /agent
│   │   └── page.tsx        ← Agent UI component (with tool call display)
│   └── admin/
│       ├── controller.tsx  ← Updated to include chatlog child route
│       ├── chatlog.tsx     ← GET handler for /admin/chatlog
│       └── chatlog/
│           └── page.tsx    ← Admin chat log viewer UI
├── routes.ts               ← Add chat, agent, admin.chatlog
├── router.ts               ← Wire controllers to routes
└── ui/
    └── layout.tsx          ← Add nav links for Chat, Agent, Admin→Chatlog
```

### Dependencies Added

- `ai` — `streamText`, `ToolLoopAgent`, `generateId`
- `@ai-sdk/openai-compatible` — OpenCode-compatible model
- `zod` — Tool input schema validation

### Environment Variables

- `OPENCODE_API_KEY` — required for AI model access (must be added to `.env`)

## Dependencies

- **Context dependency**: `utils/context.ts` (exists in my_app) — used by `utils/logger.ts`
- **Auth dependency**: Admin routes protected by `requireAuth()` + `requireAdmin()` middleware (exists in my_app)
- **DB dependency**: `data/setup.ts` and `data/schema.ts` already set up with Postgres via `remix/data-table`

## Exit Criteria

- [ ] `/chat` renders and accepts messages, stores conversations in chatlog table
- [ ] `/agent` renders with tool-calling (weather + Wikipedia), stores tool results in DB
- [ ] `/admin/chatlog` lists all conversations, supports text search, links to correct viewer
- [ ] Nav links for Chat and Agent visible in layout when logged in
- [ ] Admin nav includes link to Chat Logs
- [ ] All routes work with existing auth middleware
- [ ] `pnpm run typecheck` passes
