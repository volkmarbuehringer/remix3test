<!-- Context: bookstore-demo/lookup/messages-integration-points | Priority: high | Version: 1.0 | Updated: 2026-04-30 -->

# Messages Feature Integration Points

Quick reference for how the messages feature connects to auth, database, routing, and UI.

---

## Auth Integration

| Aspect | Detail |
|--------|--------|
| **Controller** | `middleware: [requireAuth()]` on controller export |
| **SSE endpoint** | Explicit `middleware: [requireAuth()]` in `router.map()` |
| **Nav link** | Only rendered inside `{user ? (` block in layout.tsx (line 63) |
| **Auth failures** | Redirect to `/login?returnTo=/messages` |

## Database Integration

- **Table**: `messages` (id SERIAL PK, sender_id FK→users, content TEXT, created_at BIGINT)
- **Schema**: Defined in `app/data/schema.ts` (line 434) with `beforeWrite`/`afterRead` transforms
- **Migration**: `CREATE TABLE IF NOT EXISTS` in `app/data/setup.ts` (line 270), with indexes on `sender_id` and `created_at`
- **SSR query**: Raw SQL JOIN (`pool.query`), not data-table — data-table doesn't support JOINs
- **Insert**: `db.create(messages, { ... })` via data-table for schema validation
- **PG BIGINT quirk**: BIGINT returns as string in JS; both `getAllMessages()` and `afterRead` convert with `parseInt`

## Route Definitions

```typescript
// app/routes.ts
messages: route('messages', {
  index: get('/'),
  action: post('/'),
}),
messagesSubscribe: get('/messages/subscribe'),  // ⚠️ Top-level, not nested
```

`messagesSubscribe` is a **top-level route** (not inside `route('messages')`) because the SSE endpoint:
- Needs separate middleware config
- Returns a streaming `Response` (not controller action)
- Is mapped separately in `router.ts` with inline actions

## Route Mapping

```typescript
// app/router.ts
router.map(routes.messages, messagesController)                           // Standard controller
router.map({ messagesSubscribe: routes.messagesSubscribe }, {              // SSE: inline actions
  middleware: [requireAuth()],
  actions: { messagesSubscribe() { /* ReadableStream + Response */ } },
})
```

## Layout & Navigation

| Element | Where | Detail |
|---------|-------|--------|
| Messages link | `app/ui/layout.tsx` line 63 | `<a href={routes.messages.index.href()}>Messages</a>` inside `{user ? (` block |
| Position | Between Cart and Account links | Uses `isActive()` for route highlighting |
| Conditional | Only visible to logged-in users | Same block renders Account link + Logout button |

## Test Integration

- **File**: `app/controllers/messages/controller.test.ts` — 8 tests
- **Helpers**: `createTestRouter()`, `loginAsAdmin()`, `loginAsCustomer()`, `requestWithSession()` from `test/helpers.ts`
- **Gotchas**: Rate limiter (500ms) needs `await new Promise(r => setTimeout(r, 600))` between sequential POSTs; SSE endpoint only testable for auth redirect (EventSource not portable in unit tests)

## Codebase References

| File | Key Lines |
|------|-----------|
| `app/middleware/auth.ts` | `requireAuth()`, `getPostAuthRedirect()` |
| `app/utils/context.ts` | `getCurrentUser()`, `getCurrentUserSafely()` |
| `app/data/schema.ts` | `messages` table def (line 434), `Message` type (line 468) |
| `app/data/setup.ts` | Migration (line 270), pool export (line 9) |
| `app/routes.ts` | Messages routes (lines 82-86) |
| `app/router.ts` | Controller mapping (line 102), SSE endpoint (lines 107-142) |
| `app/ui/layout.tsx` | Nav link (line 63) |

## Related

- `concepts/messages-architecture.md` — Overall architecture
- `guides/messages-sse-streaming.md` — SSE implementation details
- `errors/messages-implementation-gotchas.md` — Known issues
