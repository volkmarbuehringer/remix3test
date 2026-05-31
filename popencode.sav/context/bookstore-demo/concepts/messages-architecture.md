<!-- Context: bookstore-demo/concepts/messages-architecture | Priority: high | Version: 1.0 | Updated: 2026-04-30 -->

# Messages Feature Architecture

**Core Idea**: Real-time public message board combining SSR initial render with SSE live updates. Auth-protected, rate-limited, PostgreSQL-backed.

---

## Route Structure

| Route | Method | Purpose |
|-------|--------|---------|
| `/messages` | GET | SSR page: render all messages + send form |
| `/messages` | POST | Create message, broadcast via SSE, redirect back |
| `/messages/subscribe` | GET | SSE endpoint: `text/event-stream` for live updates |

## Data Flow

```
POST /messages
  └→ sanitizeContent() → validate non-empty
  └→ rate limit check (500ms per user ID, in-memory Map)
  └→ db.create(messages, { sender_id, content, created_at })
  └→ broadcastMessage(data) → enqueue to all sseClients
  └→ redirect 302 → /messages

GET /messages (SSR)
  └→ SELECT m.*, u.name FROM messages m JOIN users u ...
  └→ ORDER BY created_at DESC
  └→ render(<MessagesPage messages={rows} />)

GET /messages/subscribe (SSE)
  └→ requireAuth() middleware
  └→ ReadableStream with start/cancel
  └→ 2 chunks enqueued immediately (see: sendResponse workaround)
  └→ controller added to module-level sseClients Set

SSE Event: message
  └→ client EventSource receives JSON payload
  └→ prepend message item to DOM container
```

## Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| **SSE client store in separate module** (`messages-sse.ts`) | Shared between controller.tsx and router.ts; avoids circular deps |
| **SSE endpoint mapped directly in router.ts** (not via controller) | Controller middleware pattern doesn't support streaming Response from subscribe action; router.map() with inline middleware gives full control |
| **POST handler uses pool.query for rate limit, db.create for insert** | Rate limit reads need to bypass db (pure in-memory check); insert uses data-table for schema validation |
| **Client-side form intercept** | Prevents full-page navigation that kills EventSource connection |
| **Messages sorted DESC in SSR** | Newest-first matches prepend behavior on SSE receive |

## Module Dependencies

```
router.ts ──→ messages-sse.ts (imports sseClients for SSE stream setup)
            ──→ controller.tsx (routes.messages mapping)
            
controller.tsx ──→ messages-sse.ts (imports sseClients, broadcastMessage, rate limit state)
                ──→ schema.ts (messages table definition)
                ──→ setup.ts (pool for raw SQL query)
                
page.tsx ──→ controller.tsx (MessageWithSender type)
```

## Codebase References

| File | Purpose |
|------|---------|
| `bookstore/app/controllers/messages/controller.tsx` | Controller: index, action |
| `bookstore/app/controllers/messages/page.tsx` | Page: SSR list + form + SSE script |
| `bookstore/app/controllers/messages/controller.test.ts` | 8 tests covering auth, send, SSE |
| `bookstore/app/lib/messages-sse.ts` | SSE client store, broadcast, rate limiting |
| `bookstore/app/data/schema.ts` | Messages table definition (line 434) |
| `bookstore/app/data/setup.ts` | Migration + pool export (line 270) |
| `bookstore/app/routes.ts` | Route definitions (line 82) |
| `bookstore/app/router.ts` | Route mapping + SSE endpoint (lines 102, 107) |
| `bookstore/app/ui/layout.tsx` | Messages nav link (line 63) |

## Related

- `guides/messages-sse-streaming.md` — SSE streaming details + sendResponse workaround
- `lookup/messages-integration-points.md` — Auth, DB, routing integration reference
- `errors/messages-implementation-gotchas.md` — Known issues
- `../development/remix3/guides/sse-implementation.md` — Generic Remix SSE patterns
