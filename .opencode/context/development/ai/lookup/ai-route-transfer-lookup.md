<!-- Context: development/ai/lookup/ai-route-transfer-lookup | Priority: high | Version: 1.0 | Updated: 2026-04-23 -->

# Lookup: AI Route Transfer Reference

**Purpose**: Quick reference for transferring AI routes between Remix projects.

---

## File Mapping

| Source (checker) | Destination (bookstore) |
|------------------|------------------------|
| `controllers/chat/` | `controllers/chat/` |
| `controllers/agent/` | `controllers/agent/` |
| `controllers/agent2/` | `controllers/agent2/` |
| `app/routes.ts` (chat/agent/agent2) | `app/routes.ts` |
| `app/router.ts` | `app/router.ts` |

---

## New Files Created

| File | Purpose |
|------|---------|
| `app/lib/chatlog.ts` | Conversation storage |
| `app/utils/ai-provider.ts` | OpenCode provider setup |
| `app/utils/logger.ts` | Logging utility |
| `app/workflows/registry.ts` | Workflow registry |
| `app/workflows/engine.ts` | Workflow execution |
| `app/workflows/types.ts` | Workflow types |

---

## Route Configuration

```typescript
// routes.ts
chat: route('chat', { index: get('/'), action: post('/') }),
agent: route('agent', { index: get('/'), action: post('/') }),
agent2: route('agent2', { index: get('/'), action: post('/') }),
```

---

## Controller Pattern

```typescript
export default {
  actions: {
    async index({ url }) {
      // GET: load conversation, render page
    },
    async action({ get, url }) {
      // POST: process, save, redirect with chatId
    },
  },
}
```

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection (test1) |
| `OPENCODE_API_KEY` | OpenCode AI API access |

---

## Related

- `concepts/ai-route-transfer.md` - Core concept
- `guides/ai-route-transfer-guide.md` - Detailed guide