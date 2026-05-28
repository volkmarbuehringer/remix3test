<!-- Context: development/ai/concepts/ai-route-transfer | Priority: high | Version: 1.0 | Updated: 2026-04-23 -->

# Concept: AI Route Transfer Pattern

**Purpose**: Transferring AI routes (/chat, /agent, /agent2) from checker to bookstore project.

---

## Core Idea

AI routes transfer between Remix projects by: copying controllers, updating imports to local libs, registering in routes.ts + router.ts. Preserves streaming, tool-calling, and workflow execution.

---

## Components Transferred

| Route | Type | Features |
|-------|------|----------|
| `/chat` | Streaming LLM | streamText, conversation persistence |
| `/agent` | Tool Agent | ToolLoopAgent with weather + wikipedia tools |
| `/agent2` | Workflow | Async execution with run tracking |

---

## Dependencies Added

```json
{ "ai": "^4.x", "@ai-sdk/openai-compatible": "^1.x", "@ai-sdk/devtools": "^1.x", "pg": "^8.x" }
```

---

## Database Tables

```sql
-- chatlog
CREATE TABLE chatlog (
  id TEXT PRIMARY KEY, conversation JSONB NOT NULL DEFAULT '[]',
  created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL
)

-- workflow_runs
CREATE TABLE workflow_runs (
  id TEXT PRIMARY KEY, workflow_id TEXT NOT NULL, status TEXT DEFAULT 'pending',
  params JSONB, steps JSONB DEFAULT '[]', result JSONB, error TEXT,
  created_at BIGINT NOT NULL, completed_at BIGINT, created_by INTEGER
)
```

---

## Key Pattern: POST-Redirect-GET

```typescript
// POST handler → save to chatlog → redirect with chatId
return new Response(null, { status: 302, headers: { Location: `/chat?chatId=${chatId}` } })
```

---

## Environment Variables

```bash
DATABASE_URL=postgresql://...    # test1 PostgreSQL
OPENCODE_API_KEY=...            # OpenCode AI API
```

---

## 📂 Codebase References

**Controllers**:
- `bookstore/app/controllers/chat/controller.tsx` - Chat streaming controller
- `bookstore/app/controllers/agent/controller.tsx` - ToolLoopAgent controller
- `bookstore/app/controllers/agent2/controller.tsx` - Workflow controller

**Libraries**:
- `bookstore/app/lib/chatlog.ts` - Conversation storage
- `bookstore/app/utils/ai-provider.ts` - OpenCode provider
- `bookstore/app/utils/logger.ts` - Logging utility

**Workflows**:
- `bookstore/app/workflows/registry.ts` - Workflow registry
- `bookstore/app/workflows/engine.ts` - Workflow execution engine
- `bookstore/app/workflows/types.ts` - Workflow types

**Configuration**:
- `bookstore/app/routes.ts` - Route definitions (lines 74-87)
- `bookstore/app/router.ts` - Router registration (lines 99-108)
- `bookstore/app/data/setup.ts` - Database table creation (lines 205-260)

---

## Related

- `guides/ai-route-transfer-guide.md` - Step-by-step guide
- `lookup/ai-route-transfer-lookup.md` - File mapping reference